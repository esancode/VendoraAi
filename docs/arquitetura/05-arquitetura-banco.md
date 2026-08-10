Arquitetura de Banco de Dados, Multi-Tenancy e Busca Vetorial
Este documento especifica a arquitetura de armazenamento do VendoraAI, detalhando a modelagem física, a estratégia de isolamento multi-tenant por Row-Level Security (RLS), a integração nativa de busca semântica usando pgvector para RAG (Fase 3) e o fluxo automático de expurgo físico de dados em conformidade estrita com a LGPD (retenção limite de 30 dias).

1. Diretrizes de Design e Topologia
O VendoraAI adota o princípio de Simplicidade Radical ao rejeitar a complexidade operacional de manter bancos de dados separados para armazenamento transacional e vetorial [arquitetura-02-stack-tecnologica]. Toda a persistência é unificada em uma única instância gerenciada do PostgreSQL 16, utilizando a extensão nativa pgvector para as capacidades de Inteligência Artificial [arquitetura-02-stack-tecnologica].

┌────────────────────────────────────────────────────────┐
│               PostgreSQL 16 Engine                     │
├───────────────────────────┬────────────────────────────┤
│   Tabelas Relacionais     │  Tabelas de Embeddings     │
│  (Multi-Tenant via RLS)   │    (pgvector HNSW Index)   │
├───────────────────────────┴────────────────────────────┤
│            Camada de Segurança Nativa (RLS)            │
│   "tenant_id" = current_setting('app.current_tenant_id')│
└────────────────────────────────────────────────────────┘
Princípios Fundamentais da Camada de Dados:
Isolamento de Dados Estrito: Garantia matemática de que dados de um inquilino (Tenant) jamais vazem para outro, mesmo sob falhas de código do backend [arquitetura-02-stack-tecnologica].
Custo-Eficiência Operacional: Redução do custo fixo de infraestrutura a zero para o banco de vetores e escalabilidade simplificada [arquitetura-02-stack-tecnologica].
Consistência Transacional (ACID): Sincronização em tempo de gravação de mensagens e seus embeddings dentro de uma mesma transação atômica do banco, eliminando problemas de dessincronização comuns em arquiteturas distribuídas [arquitetura-02-stack-tecnologica].
Privacidade Ativa (LGPD): Suporte nativo para limpeza automatizada e irreversível dos dados sensíveis do cliente final após 30 dias de ociosidade, preservando apenas metadados analíticos para inteligência comercial [arquitetura-01-visao-geral, 03-regras-de-negocio].
2. Estratégia Multi-Tenancy e Row-Level Security (RLS)
O modelo de concorrência do VendoraAI utiliza um Banco de Dados Único com Schema Compartilhado [arquitetura-02-stack-tecnologica]. O isolamento entre diferentes lojistas (Tenants) é garantido através do uso do recurso de Row-Level Security (RLS) nativo do PostgreSQL 16 [arquitetura-02-stack-tecnologica].

Funcionamento Lógico do RLS no PostgreSQL
Toda tabela de dados sensíveis ou transacionais possui a coluna tenant_id como chave estrangeira obrigatória. O RLS atua interceptando todas as consultas (SELECT, INSERT, UPDATE, DELETE) executadas na instância, injetando uma cláusula oculta que filtra as linhas de acordo com o identificador do Tenant ativo no escopo da transação SQL atual.

Para obter o tenant_id atual, o banco lê a variável de sessão personalizada app.current_tenant_id:

-- Habilita o RLS na tabela de Leads
ALTER TABLE "Lead" ENABLE ROW LEVEL SECURITY;

-- Cria a política de isolamento para a tabela de Leads
CREATE POLICY lead_tenant_isolation ON "Lead"
  FOR ALL
  USING ("tenant_id" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);
Integração Técnica com Prisma ORM
Como o Prisma ORM gerencia conexões usando pools de conexão persistentes, não podemos definir variáveis de sessão de forma global na conexão. A solução de nível sênior do VendoraAI consiste em configurar o parâmetro dentro do contexto de uma Transação Interativa antes de qualquer operação, utilizando a diretiva SET LOCAL. A instrução SET LOCAL garante que a variável permaneça configurada apenas durante o ciclo de vida daquela transação específica, sendo redefinida automaticamente na liberação da conexão ao pool.

Implementação de um Custom Client no NestJS para Transações Multi-Tenant:
import { Injectable } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class TenantDatabaseService {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Executa operações no banco de dados sob o escopo estrito de RLS do Tenant fornecido.
   */
  async runInTenantContext<T>(tenantId: string, operation: (tx: any) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(async (tx) => {
      // Configura a variável local de transação do PostgreSQL
      await tx.$executeRawUnsafe(
        `SET LOCAL app.current_tenant_id = '${tenantId}';`
      );

      // Executa o conjunto de queries passadas no callback dentro do mesmo contexto transacional
      return await operation(tx);
    });
  }
}
Exceções de Bypass (Visão Global de Administração)
Para rotas internas de cobrança consolidada e monitoramento de desempenho (como cron jobs globais que varrem todos os tenants), as queries são executadas utilizando uma credencial/role de banco de dados que possui a propriedade BYPASSRLS configurada (por exemplo, a role proprietária das migrações do banco de dados), ou simplesmente omitindo a configuração da variável da transação ao operar com privilégios de superusuário do banco.

3. Modelo de Entidade e Relacionamento (DER)
Abaixo está estruturado o fluxo relacional das entidades transacionais. Toda tabela que herda o isolamento possui um vínculo direto com o Tenant e aplica a regra de herança física de isolamento via RLS.

       ┌────────────────────────┐
       │         Tenant         │◄─────────────────────────────┐
       └───────────┬────────────┘                              │
                   │ (1:N)                                     │
         ┌─────────┴─────────┐                                 │
         │                   │                                 │
  ┌──────▼──────┐     ┌──────▼──────┐                   ┌──────┴──────┐
  │    User     │     │ BillingRule │                   │  UsageLog   │
  └─────────────┘     └─────────────┘                   └─────────────┘
  (Roles: Admin,      (Limites de Plano)                (Métricas de IA)
   Vendedor)
         │                   │
         │ (Atribuição)      │ (1:N)
         │                   ▼
         │            ┌─────────────┐
         └───────────►│    Lead     │
                      └──────┬──────┘
                             │ (1:N)
                      ┌──────▼──────┐
                      │Conversation │
                      └──────┬──────┘
                             │ (1:N)
                      ┌──────▼──────┐
                      │   Message   │◄─────────┐ (1:1)
                      └─────────────┘          │
                                        ┌──────┴──────┐
                                        │  Embedding  │
                                        └─────────────┘
                                        (pgvector, 30 d)
4. Modelo Físico com Prisma Schema (schema.prisma)
Abaixo está o arquivo de definição técnica completa schema.prisma. Como o Prisma não possui suporte nativo ao tipo vector da extensão pgvector, mapeamos o campo utilizando a anotação Unsupported("vector(768)") para garantir suporte total em consultas nativas.

// datasource/db config
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider        = "prisma-client-js"
  previewFeatures = ["postgresqlExtensions"]
}

// Habilitação explícita das extensões necessárias no PostgreSQL
env {
  extensions = [vector, uuid_ossp]
}

// --------------------------------------------------
// Enums do Sistema
// --------------------------------------------------

enum UserRole {
  ADMIN
  AGENT
}

enum LeadStatus {
  ACTIVE
  COLD
  LOST
  WON
}

enum ConversationStatus {
  OPEN
  CLOSED
}

enum MessageSender {
  CUSTOMER
  AGENT
  SYSTEM
}

enum LossReason {
  PRICE       // Preço/Tarifa incompatível
  DELIVERY    // Prazo de entrega longo demais
  PRODUCT     // Produto não atende aos requisitos
  COMPETITION // Comprou do concorrente
  SERVICE     // Mau atendimento/lentidão
  OTHER       // Outros motivos não categorizados
}

// --------------------------------------------------
// Entidades de Negócio (Configuradas para RLS)
// --------------------------------------------------

model Tenant {
  id            String         @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid
  name          String         @db.VarChar(100)
  createdAt     DateTime       @default(now()) @map("created_at") @db.Timestamptz
  updatedAt     DateTime       @updatedAt @map("updated_at") @db.Timestamptz

  users         User[]
  leads         Lead[]
  billingRules  BillingRule[]
  usageLogs     UsageLog[]

  @@map("tenants")
}

model User {
  id           String     @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid
  email        String     @unique @db.VarChar(150)
  passwordHash String     @map("password_hash") @db.VarChar(255)
  name         String     @db.VarChar(100)
  role         UserRole   @default(AGENT)
  tenantId     String     @map("tenant_id") @db.Uuid
  createdAt    DateTime   @default(now()) @map("created_at") @db.Timestamptz
  updatedAt    DateTime   @updatedAt @map("updated_at") @db.Timestamptz

  tenant       Tenant     @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  assignedLeads Lead[]

  @@index([tenantId])
  @@map("users")
}

model Lead {
  id               String       @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid
  name             String       @db.VarChar(100)        // Nome criptografável localmente
  phone            String       @db.VarChar(20)         // WhatsApp ID ex: 5511999999999
  status           LeadStatus   @default(ACTIVE)
  tenantId         String       @map("tenant_id") @db.Uuid
  assignedUserId   String?      @map("assigned_user_id") @db.Uuid
  lastInteractionAt DateTime    @default(now()) @map("last_interaction_at") @db.Timestamptz
  slaLimitAt       DateTime?    @map("sla_limit_at") @db.Timestamptz
  createdAt        DateTime     @default(now()) @map("created_at") @db.Timestamptz
  updatedAt        DateTime     @updatedAt @map("updated_at") @db.Timestamptz

  tenant           Tenant       @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  assignedUser     User?        @relation(fields: [assignedUserId], references: [id], onDelete: SetNull)
  conversations    Conversation[]

  @@unique([tenantId, phone])   // Garante unicidade do lead por telefone dentro de cada tenant
  @@index([tenantId, status])
  @@index([tenantId, assignedUserId])
  @@index([slaLimitAt])
  @@map("leads")
}

model Conversation {
  id                 String             @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid
  leadId             String             @map("lead_id") @db.Uuid
  tenantId           String             @map("tenant_id") @db.Uuid
  status             ConversationStatus @default(OPEN)
  summary            String?            @db.Text        // Resumo executivo persistido do diálogo
  lossReason         LossReason?        @map("loss_reason")
  lossReasonDetail   String?            @map("loss_reason_detail") @db.VarChar(255)
  responseSlaSeconds Int?               @map("response_sla_seconds") // Tempo acumulado de SLA em segundos
  createdAt          DateTime           @default(now()) @map("created_at") @db.Timestamptz
  closedAt           DateTime?          @map("closed_at") @db.Timestamptz

  lead               Lead               @relation(fields: [leadId], references: [id], onDelete: Cascade)
  messages           Message[]

  @@index([tenantId, status])
  @@index([tenantId, lossReason])
  @@map("conversations")
}

model Message {
  id             String        @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid
  conversationId String        @map("conversation_id") @db.Uuid
  tenantId       String        @map("tenant_id") @db.Uuid
  sender         MessageSender
  rawContent     String?       @map("raw_content") @db.Text    // Texto bruto (Limpo aos 30 dias pela LGPD)
  maskedContent  String        @map("masked_content") @db.Text // Texto anonimizado (Preservado para histórico/RAG)
  createdAt      DateTime      @default(now()) @map("created_at") @db.Timestamptz
  responseTime   Int?          @map("response_time") @db.Integer // Tempo medido de resposta neste turno

  conversation   Conversation  @relation(fields: [conversationId], references: [id], onDelete: Cascade)
  embeddings     MessageEmbedding[]

  @@index([tenantId, createdAt])
  @@index([conversationId])
  @@map("messages")
}

// Tabela física isolada para os dados densos de vetores. Facilita o purgo de armazenamento físico.
model MessageEmbedding {
  id         String                      @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid
  messageId  String                      @map("message_id") @db.Uuid
  tenantId   String                      @map("tenant_id") @db.Uuid
  embedding  Unsupported("vector(768)") // Dimensão fixa para o text-embedding-004 do Gemini
  createdAt  DateTime                    @default(now()) @map("created_at") @db.Timestamptz

  message    Message                     @relation(fields: [messageId], references: [id], onDelete: Cascade)

  @@index([tenantId])
  @@map("message_embeddings")
}

// --------------------------------------------------
// Entidades Administrativas e Cobrança
// --------------------------------------------------

model BillingRule {
  id                 String   @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid
  tenantId           String   @unique @map("tenant_id") @db.Uuid
  planType           String   @map("plan_type") @db.VarChar(30) // STARTER, GROWTH, ENTERPRISE
  baseMonthlyPrice   Decimal  @map("base_monthly_price") @db.Decimal(10, 2)
  messageLimit       Int      @map("message_limit") @db.Integer
  tokenLimit         Int      @map("token_limit") @db.Integer
  extraMessageRate   Decimal  @map("extra_message_rate") @db.Decimal(5, 4) // Custo por webhook excedente
  extraTokenRate     Decimal  @map("extra_token_rate") @db.Decimal(5, 4)   // Custo por token de IA excedente
  createdAt          DateTime @default(now()) @map("created_at") @db.Timestamptz
  updatedAt          DateTime @updatedAt @map("updated_at") @db.Timestamptz

  tenant             Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  @@map("billing_rules")
}

model UsageLog {
  id              String   @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid
  tenantId        String   @map("tenant_id") @db.Uuid
  tokenCount      Int      @default(0) @map("token_count")
  messageCount    Int      @default(0) @map("message_count")
  billingPeriodYm String   @map("billing_period_ym") @db.VarChar(7) // Formato "YYYY-MM"
  createdAt       DateTime @default(now()) @map("created_at") @db.Timestamptz

  tenant          Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  @@index([tenantId, billingPeriodYm])
  @@map("usage_logs")
}
5. Estratégia de Busca Vetorial (pgvector)
A busca semântica do VendoraAI suportará o pipeline de RAG (Retrieval-Augmented Generation) na Fase 3, auxiliando na geração de rascunhos de resposta com base em interações anteriores vitoriosas ou regras de negócio cadastradas [01-roadmap, 04-glossario].

1. Configuração e Dimensões de Embedding
Modelo Principal: text-embedding-004 (Google Gemini) [arquitetura-02-stack-tecnologica].
Dimensão do Vetor: 768 dimensões com saída em ponto flutuante de 32 bits.
Operador de Distância: Cosine Distance (<=>), que mede a proximidade semântica angular entre vetores, ideal para correspondências semânticas de diálogos de vendas independentemente da extensão do texto bruto.
2. Escolha de Índice: HNSW (Hierarchical Navigable Small World)
Optou-se pelo índice HNSW para as buscas vetoriais em detrimento do IVFFlat devido aos seguintes critérios de produção:

Velocidade sob Carga: HNSW provê tempo de busca logarítmico e mantém altíssima taxa de recall (>98%) mesmo quando o número de registros escalona.
Sem Necessidade de Warm-up: Diferente de IVFFlat, que requer uma etapa prévia de treinamento (kmeans) assim que a tabela atinge um limite crítico, HNSW cresce organicamente sem interrupções operacionais.
Criação de Índice HNSW em Banco via Migração SQL:
CREATE EXTENSION IF NOT EXISTS vector;

-- Criação do índice com operador de cosseno vetorial
CREATE INDEX IF NOT EXISTS message_embeddings_hnsw_idx
ON "message_embeddings"
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);
Parâmetros adotados: m = 16 (número de conexões por nó, ideal para alta precisão em datasets de textos comerciais médios) e ef_construction = 64 (tempo de construção equilibrado com acurácia de busca).

3. Query SQL de Busca Semântica integrada com RLS
Graças ao uso unificado do PostgreSQL com pgvector, a query de busca vetorial respeita as políticas de RLS de forma automática e integrada [arquitetura-02-stack-tecnologica]. O comando SQL abaixo demonstra o mecanismo acionado pelo backend para buscar as 3 mensagens semanticamente mais próximas de uma nova dúvida do lead para o RAG, aplicando a restrição do Tenant ativo na sessão:

-- O backend executa o SET LOCAL na transação
SET LOCAL app.current_tenant_id = 'a3b83c74-9b21-4d3a-b851-fca1209bc291';

-- Execução da query nativa de busca semântica por similaridade de cosseno
SELECT
  msg.id,
  msg.masked_content,
  conv.summary,
  (emb.embedding <=> '[0.012, -0.054, ..., 0.341]') as distance
FROM "message_embeddings" emb
INNER JOIN "messages" msg ON msg.id = emb.messageId
INNER JOIN "conversations" conv ON conv.id = msg.conversationId
ORDER BY distance ASC
LIMIT 3;
Nota: Por causa do RLS ativo na tabela message_embeddings e messages, o PostgreSQL automaticamente elimina linhas que não pertençam ao tenant 'a3b83c74-9b21-4d3a-b851-fca1209bc291' antes de rodar a comparação do cosseno, impedindo vazamentos e otimizando a performance.

6. Política de Retenção e Expurgo Físico (LGPD - 30 Dias)
A conformidade com a LGPD e a minimização de custos de banco de dados impõem uma política estrita: o conteúdo original das mensagens deve ser excluído fisicamente e permanentemente em no máximo 30 dias de inatividade [arquitetura-01-visao-geral, 03-regras-de-negocio].

 Mensagem Recebida (Dia 1)
       │
       ▼
 ┌───────────────┐
 │  raw_content  ├───────► Guardada em texto bruto para visualização imediata do vendedor.
 └───────────────┘
 ┌───────────────┐
 │masked_content ├───────► Passa por sanitização de PII local (substitui CPFs por [CPF]).
 └───────────────┘
       │
       ├─────────────────────────────────┐
       ▼ (Aos 30 dias corridos)          ▼ (Aos 30 dias corridos)
 ┌───────────────┐                 ┌────────────────────┐
 │  raw_content  │                 │ message_embeddings │
 └───────┬───────┘                 └──────────┬─────────┘
         │                                    │
         ▼                                    ▼
 DELETADO FISICAMENTE                DELETADO FISICAMENTE
 (String substituída por NULL)      (Linha apagada em definitivo)
O que é preservado para inteligência comercial?
Para garantir que a inteligência gerencial (relatórios de SLA, motivos de perda, volumetria) continue operando perfeitamente para o lojista, as seguintes informações nunca são apagadas:

O registro conceitual e estrutural da conversa (conversations).
O resumo executivo de texto gerado por IA (summary) — que descreve as dores gerais do lead de forma agregada e sem dados pessoais.
A classificação final do motivo semântico de perda (loss_reason e loss_reason_detail).
Os tempos de SLA úteis calculados (response_sla_seconds, responseTime das mensagens).
As mensagens de texto anonimizadas (masked_content), uma vez que passaram pelo sanitizador local e não possuem rastros que possam reidentificar um cidadão físico [arquitetura-01-visao-geral, 03-regras-de-negocio].
Execução Técnica do Expurgo (Job de Purge Diário)
Para garantir que o expurgo físico ocorra de forma resiliente e irreversível, um Worker assíncrono (NestJS Scheduler + BullMQ) executa diariamente às 02:00 (GMT-3) em horário de menor utilização do sistema:

import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class LgpdRetentionService {
  private readonly logger = new Logger(LgpdRetentionService.name);
  constructor(private readonly prisma: PrismaClient) {}

  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async executeLgpdPurgeJob() {
    this.logger.log('Iniciando Job de Expurgo Físico LGPD (Limite de 30 dias)...');

    const limitDate = new Date();
    limitDate.setDate(limitDate.getDate() - 30);

    try {
      // Usamos uma query nativa direta para contornar qualquer limite de concorrência do ORM
      await this.prisma.$transaction(async (tx) => {
        // 1. Apaga embeddings de mensagens com mais de 30 dias (Reduz de forma massiva o uso de disco)
        const deletedEmbeddings = await tx.$executeRaw`
          DELETE FROM "message_embeddings"
          WHERE "created_at" < ${limitDate};
        `;

        // 2. Apaga o texto bruto (raw_content) das mensagens antigas, substituindo por NULL
        const updatedMessages = await tx.$executeRaw`
          UPDATE "messages"
          SET "raw_content" = NULL
          WHERE "created_at" < ${limitDate} AND "raw_content" IS NOT NULL;
        `;

        this.logger.log(
          `Expurgo concluído com sucesso. Embeddings removidos: ${deletedEmbeddings}. Conteúdos brutos limpos: ${updatedMessages}.`
        );
      });
    } catch (error) {
      this.logger.error('Erro crítico na execução do Job de Expurgo LGPD', error.stack);
    }
  }
}
7. Índices e Otimização de Performance
Sob uma meta de ingestão massiva e instantânea, o banco de dados deve estar configurado para evitar travamentos de tabelas (Deadlocks) e varreduras completas (Seq Scan).

Estratégia de Índices Físicos Adotada:
leads_tenant_id_phone_key (Unique Index composto):

Tabela: leads
Campos: (tenant_id, phone)
Objetivo: Permite o roteamento ultraveloz de mensagens recebidas pelo webhook do WhatsApp diretamente para o lead correspondente, além de servir como chave de UPSERT do banco.
leads_tenant_id_status_idx (Índice composto para Filas e Painel):

Tabela: leads
Campos: (tenant_id, status)
Objetivo: Acelera as buscas do painel do vendedor que filtram exclusivamente leads em estágio ativo ou frio.
leads_sla_limit_at_idx (Índice para Alertas de SLAs):

Tabela: leads
Campos: (sla_limit_at)
Objetivo: Otimiza a varredura do robô de alerta ativo que monitora quais leads estão atingindo o SLA limite de atendimento da PME.
messages_conversation_id_idx (Índice de Relacionamento):

Tabela: messages
Campos: (conversation_id)
Objetivo: Agiliza o carregamento imediato do histórico de mensagens da conversa na tela de chat do vendedor.
Manutenção e Plano de Limpeza (VACUUM)
Dado o alto volume de exclusões e atualizações (UPDATE e DELETE) causados pelo job de expurgo diário da LGPD e as constantes mensagens recebidas, as tabelas messages e message_embeddings terão uma taxa elevada de bloat (espaço em disco ocioso deixado por registros velhos).

Configurações específicas de Autovacuum serão injetadas para estas tabelas no arquivo de configuração do PostgreSQL em produção:

ALTER TABLE "messages" SET (
  autovacuum_vacuum_scale_factor = 0.05, -- Executa vacuum quando 5% das linhas forem alteradas
  autovacuum_vacuum_threshold = 1000     -- Ou no mínimo 1000 linhas alteradas
);

ALTER TABLE "message_embeddings" SET (
  autovacuum_vacuum_scale_factor = 0.05,
  autovacuum_vacuum_threshold = 500
);
8. Segurança e Criptografia em Repouso
Para mitigar riscos de vazamento ou acesso indevido à infraestrutura física do banco de dados, o VendoraAI emprega uma dupla barreira de criptografia:

┌───────────────────────────────────────────────────────────────────┐
│                       Camada de Aplicação                         │
│   Nome / Telefone ──► [ Criptografia AES-256-GCM ] ──► BD (Dados)  │
└───────────────────────────────────────────────────────────────────┘
┌───────────────────────────────────────────────────────────────────┐
│                    Camada de Infraestrutura                       │
│    PostgreSQL Storage Engine ──► [ Criptografia de Disco TDE ]    │
└───────────────────────────────────────────────────────────────────┘
Criptografia em Repouso da Infraestrutura (Transparent Data Encryption - TDE): A instância gerenciada do PostgreSQL é provisionada com criptografia de armazenamento nativa ativada (utilizando chaves AES-256 gerenciadas pelo provedor de nuvem, por exemplo, AWS KMS ou Google Cloud KMS). Isso protege dados em repouso contra acesso direto ao hardware de disco e cópias frias de arquivos de bancos de dados.

Criptografia de Colunas Sensíveis na Aplicação (Application-Level Encryption): Para dados de contato que permitem identificar o cliente (especialmente name e phone do lead), o backend do VendoraAI realiza criptografia simétrica bidirecional utilizando o algoritmo AES-256-GCM na camada do NestJS antes de efetuar o salvamento. A chave de criptografia de dados (DEK) é fornecida ao backend via variáveis de ambiente seguras (DATA_ENCRYPTION_KEY). Isso garante que, mesmo que ocorra uma falha grave de RLS ou acesso direto de leitura ao banco de dados, os telefones e nomes dos clientes permaneçam indecifráveis.