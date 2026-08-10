Arquitetura de Escalabilidade e Alta Disponibilidade
Este documento especifica a estratégia de escalabilidade horizontal, resiliência sob carga extrema e alta disponibilidade do VendoraAI. Ele detalha os mecanismos de dimensionamento para o Backend Core, a otimização de banco de dados (relacional e vetorial), a distribuição de carga nas filas de mensageria, o gerenciamento de conexões WebSockets persistentes e as estratégias de mitigação para contornar gargalos e limites de APIs de IA de terceiros.

1. Visão Geral da Estratégia de Escala
Para suportar o crescimento do volume de mensagens do WhatsApp de milhares de PMEs simultaneamente sem comprometer o SLA de ingestão (< 2 segundos) e mantendo a eficiência de custos (FinOps), a escalabilidade do VendoraAI baseia-se em três princípios fundamentais:

Desacoplamento de Estado (Stateless Architecture): Nenhuma instância de backend mantém estado em memória RAM local. Todo estado de sessão, cache de sessões e rate limits são gerenciados de forma distribuída no Redis.
Nivelamento de Carga (Load Leveling): Picos repentinos de webhooks de mensagens do WhatsApp Business API não sobrecarregam o banco de dados transacional PostgreSQL nem as APIs de LLMs. A ingestão é imediatamente colocada em fila e processada de forma assíncrona.
Escala Direcionada por Recursos (Resource-Targeted Scaling): Cada recurso de computação (CPU, memória, conexões de banco de dados, throughput de rede) é escalado de forma independente por meio de regras de auto-scaling reativas e proativas.
                              [ Internet / WhatsApp API ]
                                           │
                                           ▼
                                    [ Cloudflare CDN ]
                                           │ (HTTPS / Rate Limited)
                                           ▼
                                [ AWS Application Load Balancer ]
                                           │
                    ┌──────────────────────┴──────────────────────┐
                    ▼                                             ▼
          [ Backend ECS Task 1 ]                        [ Backend ECS Task N ]
           (NestJS / Fastify)                            (NestJS / Fastify)
                    │                                             │
      ┌─────────────┴─────────────┐                 ┌─────────────┴─────────────┐
      ▼                           ▼                 ▼                           ▼
[ Redis Cluster ]         [ PgBouncer Pool ]  [ PgBouncer Pool ]        [ Redis Cluster ]
(DB 0-3 / PubSub)         (Transaction Mode)  (Transaction Mode)        (DB 0-3 / PubSub)
                                  │                 │
                                  └────────┬────────┘
                                           ▼
                               [ PostgreSQL DB Cluster ]
                               ┌───────────┴───────────┐
                               ▼                       ▼
                        (Primary Writer)        (Read Replica 1..N)
2. Escalabilidade do Backend Core (NestJS / Fastify)
O backend do VendoraAI roda como tarefas em contêineres gerenciadas pelo AWS ECS Fargate, garantindo isolamento total de recursos e infraestrutura sem servidores para gerenciar.

2.1 Regras de Auto-Scaling (HPA)
As tarefas do ECS Fargate escalam horizontalmente de forma automática com base nas seguintes métricas do AWS CloudWatch:

Métrica de CPU (Target Tracking): Alvo configurado em 70% de utilização de CPU. Útil para picos de processamento síncrono e validação de tokens JWT/segurança.
Métrica de Memória (Target Tracking): Alvo configurado em 80% de utilização de memória. Garante proteção contra possíveis vazamentos de memória (Memory Leaks) sob tráfego sustentado.
Métrica de Fila (Custom CloudWatch Metric): Escala de forma proativa com base no volume de mensagens pendentes na fila incoming-webhooks do BullMQ.
Se incoming-webhooks.waiting > 1.500 mensagens por mais de 1 minuto $\rightarrow$ Adiciona 2 tarefas imediatamente.
Se incoming-webhooks.waiting < 100 mensagens por mais de 5 minutos $\rightarrow$ Remove tarefas gradualmente até o limite mínimo configurado.
2.2 Dimensionamento de Recursos por Tarefa (ECS Task Size)
Evitamos instâncias excessivamente grandes para facilitar tempos de inicialização rápidos (Cold Start rápido em < 15 segundos).

Configuração de Produção: 0.5 vCPU e 1 GB de RAM por tarefa do Fargate.
Limites de Concorrência do Fastify: Configurado para aceitar requisições de forma assíncrona e sem bloqueio do Event Loop do NodeJS.
3. Escalabilidade do Banco de Dados (PostgreSQL + pgvector)
O banco de dados relacional é o principal gargalo em sistemas multi-tenant de alto volume. O VendoraAI adota estratégias específicas para garantir que o PostgreSQL 16 opere em alta performance sustentada.

3.1 Roteamento Dinâmico de Réplicas de Leitura (Read Replicas)
O banco transacional é dividido em uma instância Primary Writer (para inserções, updates e deleções de mídias/mensagens) e múltiplas instâncias Reader Replicas (para visualização de painéis, relatórios e buscas de RAG).

O Prisma Client é estendido no backend do NestJS por meio de um middleware de infraestrutura para rotear as transações automaticamente:

// src/infrastructure/database/prisma-multiread.extension.ts
import { PrismaClient } from '@prisma/client';

export const prismaReadReplicasExtension = (
  writeClient: PrismaClient,
  readClients: PrismaClient[]
) => {
  return writeClient.$extends({
    query: {
      $allOperations({ model, operation, args, query }) {
        // Operações de leitura que podem ser direcionadas para réplicas
        const isReadOperation = [
          'findUnique',
          'findFirst',
          'findMany',
          'count',
          'aggregate',
          'groupBy',
        ].includes(operation);

        // Se for leitura e não estiver explicitamente envelopada em uma transação de escrita
        if (isReadOperation && readClients.length > 0) {
          const randomIndex = Math.floor(Math.random() * readClients.length);
          const replicaClient = readClients[randomIndex];

          // Executa a query na réplica de leitura selecionada aleatoriamente
          return (replicaClient as any)[model][operation](args);
        }

        // Operações de escrita sempre vão para o banco Primário
        return query(args);
      },
    },
  });
};
3.2 Pooling de Conexões com PgBouncer
Cada nova tarefa de backend em escala horizontal abre conexões de banco de dados. Sem um pooler, o PostgreSQL esgota sua memória RAM gerenciando processos de conexões ociosas.

Configuração de Infraestrutura: Implantamos uma camada de PgBouncer em modo de transação (pool_mode = transaction) à frente do RDS PostgreSQL.
Ganho de Escala: Reduz o custo de estabelecimento de conexão TCP de 15ms para < 1ms, permitindo que o PostgreSQL suporte mais de 10.000 conexões simultâneas de aplicação ativa com consumo de RAM mínimo.
Configuração no Prisma: A URL de conexão do Prisma aponta para a porta do PgBouncer (6543), adicionando o parâmetro pgbouncer=true na Connection String, enquanto as migrações (prisma migrate) usam uma conexão direta com a porta nativa do Postgres (5432) no Primary Writer.
3.3 Escalabilidade de Pesquisa Vetorial (pgvector + HNSW)
À medida que a tabela de MessageEmbedding cresce, a busca por distância cossena se torna lenta se realizada de forma sequencial (Flat Search).

Índices HNSW (Hierarchical Navigable Small World): Adotamos o índice HNSW sobre a coluna de vetor de 768 dimensões gerada pelo text-embedding-004.
Configuração do Índice:
CREATE INDEX ON "MessageEmbedding"
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);
m = 16: Define o número máximo de conexões bidirecionais por nó vetorial. Ideal para o volume de dados de chats de PMEs.
ef_construction = 64: Equilibra a velocidade de criação do índice (durante a inserção da mensagem) e a acurácia no momento de recuperação de contexto de RAG.
Otimização de Memória: O tamanho do índice HNSW deve caber totalmente na memória RAM disponível da instância PostgreSQL (shared_buffers) para evitar leituras de disco, mantendo a latência de busca semântica em < 10 milissegundos mesmo com milhões de linhas.
4. Otimização de Concorrência e Filas (Redis + BullMQ)
O processamento das mensagens que entram via webhook é distribuído e limitado de forma atômica utilizando o BullMQ sobre Redis.

4.1 Padrão "Load Leveling" contra Picos de Webhooks
Durante datas sazonais e comemorativas (como Black Friday, Natal e Dia das Mães), as PMEs parceiras experimentam aumentos repentinos de até 20x no tráfego de entrada de leads.

O gateway Fastify no backend absorve essa carga instantaneamente em menos de 50ms salvando o payload bruto em filas estruturadas de alto desempenho do BullMQ. Os contêineres workers lêem e processam essas mensagens em segundo plano conforme sua capacidade instalada de CPU e limites das APIs externas.

[ Picos de 10.000 webhooks/min ]
               │
               ▼
   [ Fastify Ingest Server ]  ──(Grava e retorna 202 Accepted em <50ms)──> [ Cliente / WhatsApp ]
               │
               ▼
       [ Redis / BullMQ ]  ──(Armazena temporariamente na memória RAM)
               │
               ▼  (Consumo controlado e estável de acordo com a capacidade do banco e limites de IA)
    [ Background Workers ]
4.2 Mitigação de Concorrência Multi-Tenant (Noisy Neighbor Protection)
Em ambientes de computação multi-tenant compartilhados, o maior risco de escalabilidade é o problema do "Vizinho Barulhento" (Noisy Neighbor), no qual um único Tenant de grande volume consome toda a fila de execução, atrasando e inviabilizando o SLA de outros Tenants menores na mesma fila.

Resolvemos este desafio utilizando o recurso Rate Limiter do BullMQ e o conceito de Filas Virtuais Dinâmicas baseadas em Grupo:

Identificador de Grupo de Job (Job ID Grouping): Cada webhook enfileirado recebe um jobId contendo a chave do Tenant: tenant_id:message_id.
Mecanismo de Limite Dinâmico: Limitamos o número máximo de execuções simultâneas por Tenant de forma automática:
// Configuração do Worker no NestJS com controle de concorrência por Tenant
const worker = new Worker('incoming-webhooks', async (job) => {
  const tenantId = job.data.tenantId;

  // Executa lógica de negócio protegida com isolamento RLS do Postgres
  await this.webhookProcessor.execute(job.data);
}, {
  connection: redisConnection,
  concurrency: 50, // Número máximo de jobs paralelos processados por este nó Worker
  limiter: {
    max: 5,        // Limita o processamento a no máximo 5 requisições ativas simultâneas...
    duration: 1000 // ...a cada 1 segundo por chave/tenant_id
  }
});
5. Escalabilidade de WebSockets (Socket.io + Redis Adapter)
Quando o backend escala horizontalmente para múltiplas tarefas do ECS Fargate, as conexões de WebSockets persistentes abertas pelos navegadores das PMEs são espalhadas por diferentes servidores de forma aleatória.

5.1 O Problema da Fragmentação de Conexões
Se o Vendedor A está conectado na Tarefa ECS 1 e o webhook de mensagens do seu lead chega e é processado pela Tarefa ECS 2, a tarefa 2 não conseguirá enviar a mensagem em tempo real para a tela do vendedor A de forma direta, pois a conexão Socket.io persistente não reside na memória dela.

5.2 Solução: Redis Pub/Sub WebSocket Adapter
Implementamos o adaptador oficial do Socket.io baseado em Redis Pub/Sub. Todas as instâncias do backend escutam e publicam mensagens no canal centralizado do Redis:

// src/infrastructure/websocket/websocket.adapter.ts
import { IoAdapter } from '@nestjs/platform-socket.io';
import { ServerOptions } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { Redis } from 'ioredis';

export class RedisIoAdapter extends IoAdapter {
  private adapterConstructor: any;

  async connectToRedis(): Promise<void> {
    const pubClient = new Redis(process.env.REDIS_URL);
    const subClient = pubClient.duplicate();

    this.adapterConstructor = createAdapter(pubClient, subClient);
  }

  createIOServer(port: number, options?: ServerOptions): any {
    const server = super.createIOServer(port, options);
    server.adapter(this.adapterConstructor);
    return server;
  }
}
Funcionamento: Quando o backend processa uma mensagem na Tarefa ECS 2, ele emite um comando de envio de socket para a sala correspondente ao tenant_id. O Redis Adapter propaga esse evento para todas as outras tarefas de backend conectadas que retransmitem instantaneamente o payload para os respectivos navegadores clientes locais.
Vantagem de Escala: Permite escalar a camada síncrona de atualização de tela ao infinito de forma 100% linear e sem perda de pacotes.
6. Escalabilidade e Proteção de APIs de IA de Terceiros
As APIs de LLMs comerciais (Google Gemini, OpenAI, Anthropic) possuem limites rígidos de RPM (Requests Per Minute), TPM (Tokens Per Minute) e RPD (Requests Per Day). Sem tratamento, o crescimento do tráfego do VendoraAI resultará em erros constantes de código HTTP 429 Too Many Requests.

6.1 Tratamento e Controle de Cota Local
Adotamos controle atômico prévio de consumo de cotas de APIs externas na nossa camada de fila e aplicação do Redis para evitar que requisições sejam enviadas a provedores que já atingiram seus limites:

Sliding Window Counter no Redis: Monitoramos os tokens e requisições gastas nos últimos 60 segundos por plano e por conta global do VendoraAI.
Enfileiramento Inteligente (Job Delaying): Se detectamos que a cota TPM global do Google Gemini 1.5 Flash está próxima de 85% de saturação, o orquestrador do BullMQ atrasa automaticamente a execução de novos rascunhos de resposta não críticos (Fase 3) em 5 a 10 segundos, priorizando o fluxo de detecção analítica e SLA de leads da Fase 1.
6.2 Estratégia de Fallback Dinâmico Multimodelo
Se o provedor de IA primário retornar erro 429 ou instabilidade de rede (503), o sistema aplica um mecanismo de degradação graciosa em tempo de execução mudando dinamicamente o modelo parceiro:

// src/infrastructure/ai/ai-escalabilidade-router.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { generateText } from 'ai';
import { google } from '@ai-sdk/google';
import { openai } from '@ai-sdk/openai';

@Injectable()
export class AiScalableRouterService {
  private readonly logger = new Logger(AiScalableRouterService.name);

  async executeWithFallback(prompt: string, tenantId: string): Promise<string> {
    try {
      // Provedor Primário: Mais rápido e econômico
      const response = await generateText({
        model: google('gemini-1.5-flash'),
        prompt,
        maxTokens: 300,
        abortSignal: AbortSignal.timeout(3000), // Timeout rígido de 3 segundos
      });

      return response.text;
    } catch (error: any) {
      this.logger.warn(`Falha na IA Primária (Gemini 1.5 Flash) para o Tenant ${tenantId}: ${error.message}`);

      // Verifica se o erro é de timeout, cota excedida (429) ou erro interno do servidor (5xx)
      const isQuotaOrServerIssue = error.status === 429 || error.status >= 500 || error.name === 'TimeoutError';

      if (isQuotaOrServerIssue) {
        this.logger.log(`Acionando Fallback secundário (GPT-4o-mini) para o Tenant ${tenantId}...`);

        try {
          // Provedor Secundário: Excelente custo-benefício e alta disponibilidade
          const response = await generateText({
            model: openai('gpt-4o-mini'),
            prompt,
            maxTokens: 300,
            abortSignal: AbortSignal.timeout(4000), // Timeout secundário ligeiramente maior
          });

          return response.text;
        } catch (fallbackError: any) {
          this.logger.error(`Falha catastrófica no provedor de IA Secundário para o Tenant ${tenantId}: ${fallbackError.message}`);
          throw new Error('Todas as camadas de processamento inteligente de IA falharam temporariamente.');
        }
      }

      throw error;
    }
  }
}
Isolamento de Erros por Tenant: Se um Tenant específico estoura sua cota de franquia contratada (Starter ou Growth), o sistema bloqueia suas chamadas de IA imediatamente na camada de validação local de negócio do backend, sem permitir que o comportamento desse cliente afete o pool geral de conexões dos outros Tenants ativos do SaaS.
7. Matriz de Parâmetros de Performance e Dimensionamento
Abaixo, resumimos as metas de infraestrutura e engenharia para assegurar a alta disponibilidade do sistema à medida que escalamos de 10 para 10.000 Tenants ativos:

Camada do Sistema	Recurso de Infraestrutura	Configuração Inicial (10 a 100 Tenants)	Configuração de Larga Escala (1000+ Tenants)	Método de Escalabilidade
Ingress Server	AWS Application Load Balancer	Single AZ	Multi-AZ ativa (3 Zonas de Disponibilidade)	Provisionamento automático via Terraform
Backend Core	AWS ECS Fargate Tasks	2 Tarefas (0.5 vCPU / 1GB RAM)	Auto-scaling dinâmico (Até 50 tarefas paralelas)	HPA reativo baseado em CPU e métricas de fila
Banco de Dados	RDS PostgreSQL 16	db.t4g.micro (Single-AZ)	db.r6g.xlarge (Multi-AZ com 3 Réplicas de Leitura)	Réplicas de leitura dinâmicas e pooling PgBouncer
Caching e Filas	Redis Cluster (ElastiCache)	Single Node (0.5GB RAM)	Cluster Sharded com Réplicas (Até 16GB RAM)	Redis Cluster Hash-Tags ({tenant_id}) nativas
Storage de Mídias	Cloudflare R2 Buckets	Bucket Compartilhado Único	Bucket Compartilhado com Políticas de Lifecycle S3	Expiração permanente em lote via script cron diário
Orquestração IA	APIs do Google e OpenAI	Plano Pay-as-you-go básico	Plano Corporativo com Limites de TPM/RPM Reservados	Roteamento dinâmico local de fallbacks e enfileiramento
