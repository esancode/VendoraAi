06-arquitetura-cache.md — Estratégia de Cache, Invalidação e Performance
1. Introdução e Objetivos
Dentro do ecossistema de alto desempenho do VendoraAI, o Redis atua não apenas como um repositório temporário de dados, mas como uma camada de aceleração de escrita e leitura e um motor de coordenação distribuída. Sob a carga projetada de até 10.000 webhooks por minuto (especialmente sob picos de campanhas promocionais de lojistas), o banco transacional PostgreSQL seria severamente penalizado se cada requisição exigisse consultas repetidas de configurações de Tenants, validações de chaves de API e status de sessão de leads.

Este documento estabelece a arquitetura física e lógica de cache e persistência em memória do VendoraAI, visando atingir os seguintes objetivos técnicos:

Latência de Ingestão Inferior a 50ms: Armazenamento em memória de metadados cruciais para autorização e roteamento rápido de webhooks.
Redução de Carga de Leitura no PostgreSQL (Cache Hit Ratio > 90%): Blindagem do banco relacional contra consultas idênticas e redundantes.
Gerenciamento de Estado Distribuído: Suporte a múltiplas instâncias do Backend Core via WebSockets coordenados por Redis Pub/Sub.
Controle Dinâmico de Tráfego: Aplicação de limites de requisição (Rate Limiting) baseados nos planos de assinatura dos lojistas de forma distribuída.
2. Topologia do Redis e Organização de Chaves
Para garantir máxima performance, isolamento e compatibilidade com futuras infraestruturas em cluster (como Redis Cluster ou AWS ElastiCache), o VendoraAI organiza seus dados em chaves estruturadas e utiliza o padrão de Hashtags do Redis ({tenant_id}) para garantir que chaves do mesmo Tenant sejam roteadas para o mesmo slot físico no cluster.

2.1. Estrutura Padrão de Nomenclatura (Prefixos)
As chaves do Redis seguem a nomenclatura hierárquica delimitada por dois pontos (:):

vendora:{contexto}:{tenant_id}:{subcontexto}:{id_recurso}
Convenção de Hashtags para Compatibilidade com Redis Cluster:
vendora:{tenant_<tenant_id>}:cache:config
vendora:{tenant_<tenant_id>}:session:lead:<lead_phone>
vendora:{tenant_<tenant_id>}:rate_limit:window:<timestamp>
Ao envolver tenant_<tenant_id> entre chaves {...}, o Redis garante que todas as operações multi-key (como transações MGET/MSET) que pertençam ao mesmo lojista sejam executadas no mesmo nó, evitando o erro clássico de Cross-Slot no Redis Cluster.

2.2. Separação de Bancos Lógicos (Redis DBs)
Em ambientes de Desenvolvimento, Staging e Produção Single-Node, utilizamos a separação por IDs de Bancos de Dados do Redis para fins de organização e isolamento de recursos:

ID DB Redis	Contexto de Aplicação	Escopo e Ferramental Relacionado
DB 0	Cache de Dados e Sessões	Dados voláteis da aplicação (Cache-Aside / Read-Through)
DB 1	Filas de Mensageria	Gerenciamento de filas assíncronas do BullMQ
DB 2	Rate Limiting	Contadores rápidos de requisições de API e Webhooks
DB 3	WebSocket State	Sincronização do Pub/Sub do Socket.io
3. Casos de Uso do Cache e Ciclo de Vida (TTL)
3.1. Sessões e Autenticação de Usuários
Os tokens de acesso JWT gerados para os vendedores e administradores não exigem consultas recorrentes ao PostgreSQL a cada rota acessada. Seus metadados de escopo (funções RBAC) são armazenados em cache.

Estratégia de Cache: Cache-Aside.
Chave no Redis: vendora:auth:session:{user_id}
Conteúdo: JSON serializado contendo: tenant_id, role (Admin/Vendedor), permissions, email.
TTL (Time-To-Live): 12 horas (Sincronizado com a expiração do JWT).
Invalidação: Exclusão ativa da chave na rota de Logout ou quando o usuário tem suas permissões revogadas por um administrador.
3.2. Metadados e Configurações de Tenants
Antes de processar qualquer webhook do WhatsApp, o sistema precisa verificar se o Tenant está ativo, qual é o seu plano e quais são suas regras operacionais (ex: Horário Comercial para cálculo de SLA).

Estratégia de Cache: Read-Through (gerenciado por service decorator).
Chave no Redis: vendora:{tenant_<tenant_id>}:cache:metadata
Conteúdo: Configurações operacionais, limite do plano (Starter, Growth, Enterprise), feriados configurados, timezone e horário de expediente.
TTL (Time-To-Live): 4 horas (com invalidação reativa a alterações).
Invalidação: Quando as configurações ou plano do Tenant são alterados via painel administrativo, o backend publica um evento de domínio que remove esta chave instantaneamente.
3.3. Estado Volátil da Conversação (Leads)
Para alimentar o motor de IA e as decisões do roteador de atendimento em tempo real, o status imediato do lead (se está em atendimento por IA, se foi transferido para humano, se está esfriando) fica armazenado em cache.

Estratégia de Cache: Write-Through (atualizado no cache e persistido assincronamente).
Chave no Redis: vendora:{tenant_<tenant_id>}:session:lead:<lead_phone_number>
Conteúdo: Estado atual (IA_ACTIVE, HUMAN_WAITING, HUMAN_ACTIVE), vendedor associado (user_id), data da última mensagem recebida, timestamp de início da sessão de SLA.
TTL (Time-To-Live): 48 horas (tempo máximo em que uma conversa de WhatsApp é considerada "ativa" comercialmente antes do arquivamento).
4. Estratégias de Gerenciamento de Cache
4.1. Cache-Aside (Lazy Loading)
Esta estratégia é amplamente utilizada para listagens de insights consolidados e perfis de lojistas. O fluxo de leitura obedece ao seguinte algoritmo implementado no Core do Backend:

graph TD
    A[Requisição do Cliente] --> B{Existe no Redis?}
    B -- Sim Cache Hit --> C[Retorna do Redis]
    B -- Não Cache Miss --> D[Consulta no PostgreSQL]
    D --> E[Salva resultado no Redis com TTL]
    E --> F[Retorna do PostgreSQL]
Exemplo de Implementação de Serviço de Cache Genérico com NestJS:
import { Injectable, Inject } from '@nestjs/common';
import { Redis } from 'ioredis';

@Injectable()
export class CacheService {
  constructor(@Inject('REDIS_CLIENT') private readonly redis: Redis) {}

  async getOrSet<T>(
    key: string,
    ttlInSeconds: number,
    fetchFunction: () => Promise<T>
  ): Promise<T> {
    const cachedValue = await this.redis.get(key);

    if (cachedValue) {
      return JSON.parse(cachedValue) as T;
    }

    // Cache Miss - Executa a consulta de origem (Postgres/API)
    const freshData = await fetchFunction();

    if (freshData !== null && freshData !== undefined) {
      await this.redis.set(
        key,
        JSON.stringify(freshData),
        'EX',
        ttlInSeconds
      );
    }

    return freshData;
  }

  async invalidate(key: string): Promise<void> {
    await this.redis.del(key);
  }
}
5. Políticas de Invalidação de Cache e Despejo
A consistência de dados entre o cache e o banco relacional é um quesito crítico. Se o lojista alterar o horário comercial da sua empresa, o cálculo do SLA de novas mensagens deve se adaptar a essa regra imediatamente.

5.1. Políticas de Invalidação por Eventos (Active Eviction)
Em vez de confiar unicamente no tempo de expiração natural (TTL), o VendoraAI implementa Invalidação Baseada em Eventos. Sempre que houver uma mutação de dados (escrita, atualização ou deleção) que afete registros cacheados, a aplicação emite um evento local que limpa o cache correspondente.

Exemplo de Fluxo de Mutação:
O vendedor edita as regras de atendimento no Painel Web (PUT /tenants/settings).
O controlador grava a alteração no PostgreSQL via Prisma.
O Caso de Uso dispara um evento de domínio: TenantSettingsUpdatedEvent.
O Listener correspondente intercepta o evento e executa:
await cacheService.invalidate(`vendora:{tenant_${tenantId}}:cache:metadata`);
O próximo webhook recebido disparará um Cache Miss, buscando os dados atualizados diretamente do banco e re-alimentando o Redis.
5.2. Política de Despejo de Memória (Maxmemory Policy)
Quando o servidor Redis atinge seu limite de alocação física de memória RAM (maxmemory), ele deve descartar chaves para continuar operando. A política global configurada no arquivo redis.conf do VendoraAI é:

maxmemory-policy allkeys-lru
Justificativa Técnica:
allkeys-lru: Despeja as chaves menos utilizadas recentemente (Least Recently Used) de todo o espectro do Redis, independentemente de possuírem um TTL definido. Isso garante que chaves altamente consumidas em tempo real (como rate limits de webhooks e estados de conversas quentes) permaneçam em memória enquanto dados analíticos frios são limpos se a memória apertar.
Nota técnica: Para chaves do BullMQ (DB 1), não há risco de despejo acidental de jobs de fila pela política LRU, pois o BullMQ é isolado em seu próprio banco lógico do Redis e possui regras de retenção estritas gerenciadas pelas propriedades dos jobs.

6. Rate Limiting Dinâmico Distribuído
Para proteger as APIs do VendoraAI contra ataques de negação de serviço (DDoS) e garantir que as PMEs respeitem os limites operacionais de seus planos de assinatura (evitando surpresas na fatura de APIs de IA), implementamos um Rate Limiter distribuído baseado em Redis.

O algoritmo escolhido é o Sliding Window Counter (Contador de Janela Deslizante), que oferece alta precisão temporal sem os picos de permissão observados no algoritmo de Fixed Window (Janela Fixa).

6.1. Algoritmo Sliding Window no Redis (via Multi/Exec)
A janela móvel é controlada de forma atômica no Redis utilizando estruturas do tipo Sorted Set (ZSET). Cada requisição adiciona um item único ao ZSET onde o score é o timestamp em milissegundos.

Operação Lógica do Algoritmo por Requisição:
Limpar registros antigos: Remove todos os elementos do ZSET cujo timestamp seja menor que a janela de tempo atual (ZREMRANGEBYSCORE).
Contar requisições ativas: Retorna a quantidade de elementos restantes no ZSET (ZCARD).
Validar limite: Se o retorno de ZCARD for inferior ao teto configurado para o plano do Tenant, a requisição é liberada.
Adicionar nova requisição: Adiciona o timestamp atual ao ZSET (ZADD) e renova o TTL da chave para evitar acúmulo de chaves ociosas (EXPIRE).
Script Lua Otimizado para Execução Atômica (Single Network Roundtrip):
local key = KEYS[1]
local now = tonumber(ARGV[1])
local window = tonumber(ARGV[2])
local limit = tonumber(ARGV[3])
local clear_before = now - window

redis.call('ZREMRANGEBYSCORE', key, 0, clear_before)
local current_requests = redis.call('ZCARD', key)

if current_requests < limit then
    redis.call('ZADD', key, now, now)
    redis.call('EXPIRE', key, math.ceil(window / 1000))
    return 1 -- Permitido
else
    return 0 -- Bloqueado (Rate Limit Excedido)
end
6.2. Matriz Dinâmica de Rate Limits por Plano
Conforme delimitado em docs/03-regras-de-negocio.md, as regras de consumo de API são aplicadas dinamicamente consultando os limites em cache:

Plano	Limite Geral API (/api/*)	Limite Webhook WhatsApp	TTL da Janela
Starter	60 requisições / minuto	100 mensagens / minuto	60 segundos
Growth	120 requisições / minuto	300 mensagens / minuto	60 segundos
Enterprise	Personalizado (padrão: 500/min)	Sem limite rígido (auto-scale)	60 segundos
7. Distribuição de WebSockets e Sincronização de Estado (Scale-Out)
O VendoraAI utiliza WebSockets para fornecer uma experiência fluida de Live Chat e alertas rápidos de resfriamento de leads em tempo real aos navegadores dos vendedores. Conforme o backend cresce e escala horizontalmente com múltiplas instâncias NodeJS em execução, um navegador conectado à Instância A não receberia mensagens processadas pela Instância B sem um coordenador centralizado.

Para sanar este gargalo de distribuição, configuramos o Redis Pub/Sub como adaptador do Socket.io.

                        [ Painel Web Vendedor ]
                            ▲             ▲
                   WebSocket│             │WebSocket
                            │             │
                    ┌───────┴──────┐      ┌───────┴──────┐
                    │  Instância A │      │  Instância B │
                    └───────┬──────┘      └───────┬──────┘
                            │                     │
                            └───►[ Redis Pub/Sub ]◄───┘
                                   (Adaptador)
7.1. Fluxo de Publicação e Roteamento
Um webhook com mensagem do lead é processado pela Instância B do backend.
O Caso de Uso executa as mutações no banco e dispara o evento MessageReceived.
A Instância B envia uma notificação WebSocket direcionada ao Tenant correspondente.
O adaptador do Redis Pub/Sub intercepta a mensagem do socket e a publica no canal Redis global (vendora:websocket:pubsub).
A Instância A (que possui o vendedor ativamente conectado via WebSocket) recebe o sinal de Pub/Sub e encaminha a mensagem instantaneamente para o navegador do cliente.
8. Monitoramento, Métricas e Resiliência do Cache
Para assegurar que o Redis opere sob condições saudáveis de performance em produção, definimos as seguintes métricas de acompanhamento contínuo via Grafana com Prometheus Redis Exporter.

8.1. Métricas Críticas a Serem Monitoradas
redis_connected_clients (Clientes Conectados): Alerta caso o número de conexões estoure o teto máximo permitido do sistema operacional.
used_memory_percent (Percentual de Memória Utilizada): Indica se o tamanho do cache está se aproximando do limite físico (maxmemory). Alerta amarelo em 80%, crítico em 95%.
evicted_keys_rate (Taxa de Despejo de Chaves): Mede a quantidade de chaves que estão sendo excluídas antes do término do seu TTL para dar espaço a novos dados. Se estiver alto, indica que o Redis está subdimensionado fisicamente.
cache_hit_ratio (Eficiência de Cache): Calculado pela fórmula: $$\text{Hit Ratio} = \frac{\text{keyspace_hits}}{\text{keyspace_hits} + \text{keyspace_misses}}$$ Alvo do VendoraAI: Manter o Hit Ratio de dados de leitura geral acima de 90% em ambiente produtivo.
8.2. Tratamento de Indisponibilidade do Redis (Fallback)
Embora o Redis seja altamente resiliente, a aplicação NestJS deve possuir tolerância a falhas para não indisponibilizar o core do sistema caso o servidor Redis sofra uma queda.

Diretrizes de Fallback do Backend:
Comportamento Silent Fail para Leitura: Se a conexão com o Redis cair, todas as rotas que utilizam o CacheService devem capturar a exceção e redirecionar a consulta diretamente para o banco de dados PostgreSQL (Bypass). O tempo de resposta aumentará ligeiramente, mas o serviço permanecerá online.
Políticas de Retry do ioredis: O cliente ioredis é instanciado com estratégias de reconexão exponencial automática:
const redis = new Redis({
  host: process.env.REDIS_HOST,
  retryStrategy: (times) => {
    const delay = Math.min(times * 50, 2000);
    return delay; // Reconecta em no máximo 2 segundos
  }
});
Degradação de Rate Limit: Na ausência temporária do Redis, o middleware de Rate Limit assume um comportamento local em memória RAM no próprio processo NodeJS (armazenamento estático volátil), degradando graciosamente sem bloquear os lojistas legítimos de forma cega.