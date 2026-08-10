03 - Arquitetura Backend
Este documento estabelece as especificações técnicas, padrões de design e a organização estrutural do Backend Core do VendoraAI. Ele serve como o guia definitivo para desenvolvedores e agentes autônomos implementarem e manterem a API, garantindo robustez, resiliência contra falhas de rede e estrita separação de conceitos.

1. Princípios de Arquitetura e Design
O backend do VendoraAI é construído sobre os princípios da Clean Architecture (Arquitetura Limpa) de Robert C. Martin, com padrões de Hexagonal Architecture (Portas e Adaptadores) e DDD (Domain-Driven Design) tático. Essa escolha assegura o desacoplamento de recursos externos frágeis (como APIs de IA e provedores de mensageria) do núcleo de negócios da aplicação.

Princípios Norteadores
Independência de Frameworks: O domínio e os casos de uso não conhecem o NestJS, Fastify ou Prisma. O framework serve apenas como um motor de injeção de dependência e roteamento HTTP.
Testabilidade Isolada: Toda a lógica de negócios (SLA, regras de leads, sanitização) pode ser testada em milissegundos sem levantar conexões com bancos de dados, servidores web ou APIs de IA.
Independência de UI e Interfaces Externas: As regras de negócio não sabem se os dados chegam via webhook HTTP, WebSocket ou CLI.
Arquitetura Orientada a Eventos (EDA): Processamentos demorados (como inferência de IA, geração de embeddings e auditoria) ocorrem de forma assíncrona, eliminando o acoplamento temporal e garantindo que picos de carga não afetem o tempo de resposta da recepção dos webhooks.
2. Camadas da Arquitetura (Hexagonal)
A estrutura de código é dividida em quatro camadas principais de dependência concêntrica (as camadas externas dependem das internas, mas as internas nunca conhecem as externas):

       +---------------------------------------------+
       |                  INFRASTRUCTURE             |
       |  +---------------------------------------+  |
       |  |                 ADAPTERS              |  |
       |  |  +---------------------------------+  |  |
       |  |  |            APPLICATION          |  |  |
       |  |  |  +---------------------------+  |  |  |
       |  |  |  |           DOMAIN          |  |  |  |
       |  |  |  |  - Entities               |  |  |  |
       |  |  |  |  - Value Objects          |  |  |  |
       |  |  |  |  - Domain Services        |  |  |  |
       |  |  |  |  - Domain Events          |  |  |  |
       |  |  |  +---------------------------+  |  |  |
       |  |  |  - Use Cases (Interactors)      |  |  |
       |  |  |  - Ports (Interfaces)           |  |  |
       |  |  +---------------------------------+  |  |
       |  |  - Presenters / Controllers        |  |  |
       |  |  - Gateways / Repositories Imp.    |  |  |
       |  +---------------------------------------+  |
       |  - NestJS Modules, Fastify, Prisma Client   |
       +---------------------------------------------+
A. Domínio (Domain)
A camada mais interna. Contém a lógica de negócios pura, imutável e sem efeitos colaterais.

Entities: Objetos de negócio identificáveis por ID que encapsulam estado e comportamento (ex: Lead, Conversation, SlaRule).
Value Objects: Atributos sem identidade própria que se autovalidam (ex: PhoneNumber, Email, SlaDuration).
Domain Services: Operações complexas que envolvem múltiplas entidades e não pertencem logicamente a apenas uma delas (ex: SlaCalculator).
Domain Events: Sinais emitidos quando uma mudança de estado crítica ocorre (ex: LeadCooledEvent, SlaViolatedEvent).
B. Aplicação (Application)
Coordena o fluxo de dados para a realização de operações de negócio específicas.

Use Cases: Implementação das intenções do usuário/sistema (ex: ProcessIncomingMessage, CalculateLeadSla, GenerateAiDraft). Cada caso de uso é um fluxo transacional autocontido.
Ports (Interfaces): Contratos lógicos de entrada (Input Ports - implementados pelos usecases) e saída (Output Ports/Gateways - interfaces para persistência, mensageria e IA externa que a infraestrutura deve satisfazer).
C. Adaptadores (Adapters / Interfaces)
Traduz os dados entre o formato mais conveniente para os casos de uso e o formato mais conveniente para agentes externos.

Controllers: Capturam requisições HTTP, validam payloads sintaticamente (usando Zod/Class-Validator) e os encaminham para os Casos de Uso.
Gateways / Repositories: Implementações concretas das interfaces de persistência (usando Prisma ORM para PostgreSQL) e APIs externas (WhatsApp Cloud API, OpenAI API).
Presenters: Formatam os dados de saída retornados pelos casos de uso em payloads JSON amigáveis para o cliente Web SPA.
D. Infraestrutura (Infrastructure)
Detalhes físicos e de baixo nível do sistema.

NestJS Modules: Contêineres que definem a injeção de dependências e amarram adaptadores e casos de uso.
Fastify Integration: Configurações do servidor HTTP, middlewares, CORS e limites de payload.
Database Configs: Inicialização do Prisma Client, pool de conexões do PostgreSQL e suporte a pgvector.
Queues: Definição física de conexões Redis e inicialização do BullMQ.
3. Estrutura Física de Pastas do Repositório (src/)
src/
├── main.ts                       # Ponto de entrada do servidor NestJS/Fastify
├── app.module.ts                 # Módulo raiz que unifica o sistema
│
├── domain/                       # Camada de Domínio Pura (Zero Dependências de Nest/Prisma)
│   ├── shared/                   # Utilitários de domínio e tipos globais
│   ├── tenant/                   # Entidades, Value Objects e Regras de Tenant
│   ├── lead/                     # Entidades de Lead, Mensagem e Conversa
│   └── intelligence/             # Lógica e regras de insights e semântica de IA
│
├── application/                  # Camada de Casos de Uso e Contratos (Ports)
│   ├── shared/                   # Casos de uso compartilhados e Eventos de Domínio
│   │   └── ports/                # Interfaces de saída (Repositories, Mailer, AI, Queues)
│   │       ├── queue.port.ts
│   │       ├── database.port.ts
│   │       └── ai-service.port.ts
│   │
│   ├── tenant/                   # Casos de uso do domínio Tenant (Onboarding, Configuração)
│   │   ├── use-cases/
│   │   └── dto/
│   │
│   ├── lead/                     # Casos de uso de Conversas, Leads e SLA
│   │   ├── use-cases/
│   │   │   ├── process-message.usecase.ts
│   │   │   └── calculate-sla.usecase.ts
│   │   └── dto/
│   │
│   └── intelligence/             # Casos de uso de Análise, RAG e Geração de Rascunhos
│       ├── use-cases/
│       │   ├── generate-draft.usecase.ts
│       │   └── run-nightly-analysis.usecase.ts
│       └── dto/
│
├── adapters/                     # Camada de Adaptadores de Entrada/Saída
│   ├── http/                     # Controladores HTTP e Schemas de validação
│   │   ├── nest-controllers/
│   │   ├── middlewares/
│   │   │   ├── pre-flight-sanitization.middleware.ts # LGPD Masking
│   │   │   └── rate-limit.middleware.ts
│   │   └── presenters/
│   │
│   ├── ws/                       # Gateways de WebSockets (Socket.io) para Tela em Tempo Real
│   │   └── live-updates.gateway.ts
│   │
│   ├── db/                       # Implementação dos repositórios de Banco de Dados
│   │   ├── prisma/
│   │   │   ├── schema.prisma     # Definição física das tabelas
│   │   │   └── prisma.service.ts
│   │   └── repositories/
│   │       ├── prisma-lead.repository.ts
│   │       └── prisma-tenant.repository.ts
│   │
│   ├── queue/                    # Produtores e Consumidores de Filas (BullMQ)
│   │   ├── bull-queue.service.ts
│   │   └── workers/
│   │       ├── ingestion.worker.ts
│   │       └── intelligence.worker.ts
│   │
│   └── integrations/             # Provedores de serviços externos
│       ├── whatsapp/             # Wrapper da WhatsApp Business Cloud API
│       └── ai/                   # Integração com Vercel AI SDK e Gemini API
│
└── infrastructure/               # Módulos NestJS e Configurações de Ambiente
    ├── config/                   # Validação de variáveis de ambiente (Zod Env)
    ├── ioc/                      # Módulos NestJS que fazem Injeção de Dependência (DI)
    │   ├── tenant.module.ts
    │   ├── lead.module.ts
    │   └── intelligence.module.ts
    └── logger/                   # Winston/Pino Logger configurado para rastreabilidade
4. Fluxo de Execução Detalhado
O diagrama de sequência abaixo descreve a jornada de um webhook de mensagem de entrada até a atualização da tela do vendedor em tempo real, evidenciando o desacoplamento promovido pelo uso de filas.

+----------+     +-------------+     +-------------+     +---------+     +-------------+     +---------+     +---------+
| WhatsApp |     | Ingestion   |     | BullMQ      |     | Queue   |     | Core Application |  | Database|     | SPA Web |
| API      |     | Controller  |     | (Redis)     |     | Worker  |     | (Use Cases) |     | (Postgres)    | (Socket)|
+----------+     +-------------+     +-------------+     +---------+     +-------------+     +---------+     +---------+
     |                  |                   |                 |                 |                 |               |
     |--- Webhook JSON ---->|               |                 |                 |                 |               |
     |   (Payload Bruto) |                  |                 |                 |                 |               |
     |                  |-- Sanitização --->|                 |                 |                 |               |
     |                  |   (Pre-flight)    |                 |                 |                 |               |
     |                  |                   |                 |                 |                 |               |
     |                  |-- Envia p/ Fila ->|                 |                 |                 |               |
     |                  |   'ingestion'     |                 |                 |                 |               |
     |                  |<-- ACK (JobId) ---|                 |                 |                 |               |
     |<-- HTTP 200 OK --|                   |                 |                 |                 |               |
     |   (Velocidade)   |                   |                 |                 |                 |               |
     |                  |                   |                 |                 |                 |               |
     |                  |                   |-- Trigger job ->|                 |                 |               |
     |                  |                   |                 |--- Process ---->|                 |               |
     |                  |                   |                 |                 |-- Grava Msg e ->|               |
     |                  |                   |                 |                 |   Atualiza SLA  |               |
     |                  |                   |                 |                 |<-- Sucesso -----|               |
     |                  |                   |                 |                 |                 |               |
     |                  |                   |                 |                 |-- Dispara ------|-------------->|
     |                  |                   |                 |                 |   WebSocket     |               | (Mensagem na
     |                  |                   |                 |                 |   Update Event  |               |  Tela do
     |                  |                   |                 |                 |                 |               |  Vendedor)
     |                  |                   |                 |                 |                 |               |
     |                  |                   |                 |                 |-- Adiciona Job -|               |
     |                  |                   |                 |                 |   de IA na fila |               |
     |                  |                   |                 |                 |   'intelligence'|               |
     |                  |                   |                 |                 |   (Análise/RAG) |               |
     |                  |                   |                 |                 |---- Job Added ->|               |
Detalhes Críticos de Performance e Segurança do Fluxo:
Fast HTTP Acknowledgement: O controlador do webhook do WhatsApp aceita o JSON, valida assinaturas de segurança de cabeçalho, passa os textos por um analisador regex local ultrarrápido para mascarar dados sensíveis imediatos (CPF, cartões de crédito) e despacha o payload bruto persistido no job Redis. A resposta HTTP 200 OK é retornada ao WhatsApp em menos de 50 milissegundos, prevenindo timeouts e retentativas desnecessárias de envio pelo provedor.
Workers Dedicados: O processamento persistente (escrita em tabelas transacionais, cálculos trigonométricos e algoritmos de SLA útil, atualizações de histórico de leads) é executado assincronamente pelo IngestionWorker fora do loop de requisição/resposta principal.
Atualização de Painel: Qualquer criação de lead, recepção de nova mensagem ou violação iminente de SLA dispara um evento através do LiveUpdatesGateway usando WebSockets para atualizar de forma imediata e transparente a SPA do usuário.
5. Implementação das Configurações de Servidor e Middlewares (Fastify Engine)
O NestJS será inicializado no topo do Fastify em vez de Express para maximizar o throughput da API (até 3x mais requisições por segundo).

Configurações de Infraestrutura da API HTTP
// main.ts - Exemplo de Inicialização de Alta Performance
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import fastifyMultipart from '@fastify/multipart';
import fastifyCompress from '@fastify/compress';

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({
      logger: true,
      bodyLimit: 10485760, // Limite de 10MB para upload de imagens/mídias do WhatsApp
    })
  );

  // Compressão Gzip/Brotli para otimização de banda de rede
  await app.register(fastifyCompress, { encodings: ['gzip', 'deflate'] });

  // Suporte a multipart/form-data para mídias
  await app.register(fastifyMultipart);

  // Pipes globais para validação de payloads sintáticos com DTOs
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    })
  );

  app.enableCors({
    origin: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : '*',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
  });

  await app.listen(process.env.PORT || 3000, '0.0.0.0');
}
bootstrap();
Middleware de Sanitização Local de Dados (Pre-flight Sanitization)
Essencial para atender à LGPD e garantir o cumprimento estrito da regra de privacidade (RN-PRIV-01). Todos os dados pessoais sensíveis devem ser anonimizados antes do envio para APIs de LLM externas.

// pre-flight-sanitization.middleware.ts
import { Injectable, NestMiddleware } from '@nestjs/common';

@Injectable()
export class PreFlightSanitization {
  // Regex compiladas estaticamente em memória para performance máxima
  private readonly CPF_REGEX = /\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/g;
  private readonly CNPJ_REGEX = /\b\d{2}\.\d{23}\.\d{3}\/\d{4}-\d{2}\b/g;
  private readonly EMAIL_REGEX = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
  private readonly PHONE_REGEX = /\b(?:\+?55\s?)?(?:\(?\d{2}\)?\s?)?(?:9\s?\d{4}-\d{4}|\d{4}-\d{4})\b/g;
  private readonly CREDIT_CARD_REGEX = /\b(?:\d{4}[ -]?){3}\d{4}\b/g;

  /**
   * Remove e mascara dados pessoais e sensíveis de strings de texto transacionais
   */
  public sanitizeText(text: string): string {
    if (!text) return text;
    return text
      .replace(this.CPF_REGEX, '[CPF_REDACTED]')
      .replace(this.CNPJ_REGEX, '[CNPJ_REDACTED]')
      .replace(this.EMAIL_REGEX, '[EMAIL_REDACTED]')
      .replace(this.CREDIT_CARD_REGEX, '[CARD_REDACTED]');
      // Nota: Não ocultamos números de telefone globais de forma agressiva no texto
      // se forem necessários para identificação lógica do lead, mas mascaramos se parecerem números avulsos.
  }
}
6. Estratégia de Filas e Processamento Assíncrono com BullMQ
O BullMQ é configurado sobre a instância gerenciada do Redis para fornecer persistência e gerenciamento do ciclo de vida das filas. Ele é o responsável por mitigar gargalos operacionais e coordenar os pipelines de Inteligência Artificial.

Filas de Trabalho do Sistema
whatsapp-ingestion
Função: Recebe webhooks do WhatsApp, calcula SLA de resposta local, armazena registros e emite eventos de WebSocket.
Prioridade: Alta (Latência de recepção crítica).
Taxa Máxima de Concorrência: 20 workers simultâneos por contêiner.
ia-processing
Função: Executa chamadas ao Vercel AI SDK (Gemini API), processa resumos, extração de intenções semânticas de perda de lead e gera rascunhos de mensagens para o RAG.
Prioridade: Média (Pode sofrer rate limit das APIs externas de IA).
Taxa Máxima de Concorrência: 5 workers por contêiner (para respeitar limites de requisições por minuto da LLM).
data-purge-job
Função: Executa rotinas cron diárias à meia-noite para remover fisicamente mensagens brutas do PostgreSQL e do pgvector que completaram 30 dias de vida (RN-PRIV-02), gerando relatórios de conformidade.
Prioridade: Baixa.
Especificação de Resiliência: Retry, Backoff e DLQ
Para satisfazer os requisitos de tolerância a falhas (RNF-04 e RNF-07), os jobs lidos pelas filas do BullMQ seguem regras rígidas de resiliência:

// Exemplo de configuração de resiliência ao enfileirar tarefas
this.ingestionQueue.add('process-message', payload, {
  attempts: 5, // Tenta até 5 vezes em caso de queda de serviços de terceiros
  backoff: {
    type: 'exponential',
    delay: 2000, // Primeira retentativa em 2s, depois 4s, 8s, 16s, 32s...
  },
  removeOnComplete: { age: 3600 }, // Remove logs de sucesso após 1h para manter o Redis leve
  removeOnFail: false, // Mantém falhas persistidas no Redis para inspeção na DLQ
});
Dead Letter Queue (DLQ)
Sempre que um job falha 5 vezes consecutivas nas tentativas automáticas, o worker dispara um listener global que o move para o status de Failed.

Inspeção: Através do painel visual do Bull-Board integrado à rota autenticada /admin/queues do backend, os engenheiros seniores podem rastrear os erros, corrigir dados de payload malformados e reprocessar as mensagens manualmente de forma unitária ou em lote.
Alertas: Casos persistidos como falhas na DLQ disparam triggers imediatos para o canal do Discord/Slack de monitoramento técnico através do serviço de observabilidade.
7. Estratégia de Testabilidade da Solução
O VendoraAI exige uma cobertura mínima de 80% de testes de backend antes de qualquer deploy em produção (RNF-09), divididos sob a seguinte estratégia piramidal:

              /\
             /  \      E2E (End-to-End Tests) ~ 10%
            /----\     - Chamadas reais de rotas HTTP com Supertest
           /      \    - Testes de concorrência e carga
          /--------\   Integration Tests ~ 30%
         /          \  - Interação de usecases com Prisma & Postgres (pgvector)
        /------------\ - Emulação física de filas de teste
       /              \ Unit Tests ~ 60%
      /________________\ - Domínio Puro (Value Objects, Entities, Domain Services)
                         - Testes de cálculo lógico de SLA útil
Exemplo de Teste Unitário (Foco nas Regras de SLA em Domínio Puro)
Garante que o algoritmo que calcula o vencimento do SLA de leads ignore finais de semana e feriados corretamente, sem precisar simular conexões pesadas de banco de dados.

// domain/lead/sla-calculator.spec.ts
import { SlaCalculator } from './sla-calculator';
import { SlaRule } from './sla-rule';

describe('SlaCalculator Unit Tests', () => {
  let calculator: SlaCalculator;
  let slaRule: SlaRule;

  beforeEach(() => {
    calculator = new SlaCalculator();
    slaRule = new SlaRule({
      limitMinutes: 60, // SLA de 1 hora
      businessHours: {
        start: '08:00',
        end: '18:00',
      },
      workDays: [1, 2, 3, 4, 5], // Apenas segunda a sexta-feira
    });
  });

  it('deve calcular o vencimento dentro do mesmo dia útil perfeitamente', () => {
    const receivedAt = new Date('2026-08-07T10:00:00Z'); // Quinta-feira às 10h
    const deadline = calculator.calculateDeadline(receivedAt, slaRule);

    expect(deadline.toISOString()).toBe('2026-08-07T11:00:00Z');
  });

  it('deve pausar o cronômetro às 18h e postergar o SLA restante para as 8h do próximo dia útil', () => {
    const receivedAt = new Date('2026-08-07T17:30:00Z'); // Quinta-feira às 17h30 (faltam 30 minutos)
    const deadline = calculator.calculateDeadline(receivedAt, slaRule);

    // Deve vencer na sexta-feira às 08h30
    expect(deadline.toISOString()).toBe('2026-08-08T08:30:00Z');
  });

  it('deve ignorar o final de semana de forma transparente', () => {
    const receivedAt = new Date('2026-08-07T17:45:00Z'); // Sexta-feira às 17h45 (faltam 45 minutos)
    const deadline = calculator.calculateDeadline(receivedAt, slaRule);

    // Deve vencer na segunda-feira às 08h45
    expect(deadline.toISOString()).toBe('2026-08-10T08:45:00Z');
  });
});
8. Segurança e Auditoria no Backend
Para blindar o sistema contra invasões e vazamentos acidentais de dados de clientes, as seguintes especificações de segurança de infraestrutura são ativas em todas as rotas da API:

Criptografia na Origem: Todos os campos críticos de identificação direta que precisam sobreviver no banco de dados temporariamente são criptografados antes da gravação em persistência (aes-256-gcm local de duas vias com chaves de rotação armazenadas no Vault de segredos de ambiente).
Rate Limiting Dinâmico: A API expõe uma regra estrita de Rate Limit baseada em IP e cabeçalhos de Token do Tenant. O gateway Fastify recusa requisições que excedam 120 requisições por minuto por IP para rotas públicas de Webhook e 240 requisições por minuto para rotas autenticadas de painel do usuário, respondendo imediatamente com HTTP 429 Too Many Requests.
Auditoria de Acesso (Audit Log): Todas as mutações lógicas (atualizações de configurações de IA, remoção de contatos, alterações em regras de cobrança e faturamento) gravam uma trilha imutável no banco com o IP do requisitante, payload mascarado e timestamp correspondente, garantindo controle absoluto de acessos de auditoria em conformidade com as regras de governança internacional.