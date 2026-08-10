07-arquitetura-filas.md — Arquitetura de Filas e Mensageria
Este documento especifica a Arquitetura de Filas, Processamento Assíncrono e Mensageria do VendoraAI. Para garantir a resiliência do sistema, o isolamento transacional e o controle estrito de custos operacionais com IA, toda a ingestão de tráfego pesado e os pipelines de inteligência são desacoplados por meio de filas duráveis gerenciadas pelo BullMQ sobre a infraestrutura do Redis.

1. Objetivos da Arquitetura de Filas
A arquitetura de mensageria assíncrona do VendoraAI foi desenhada para resolver três desafios críticos de engenharia:

Absorção de Picos de Tráfego (Load Leveling): Evitar que campanhas de marketing massivas disparadas por lojistas (Tenants) que geram picos de até 10.000 webhooks por minuto sobrecarreguem o banco de dados relacional ou causem indisponibilidade no gateway de API.
Isolamento de Gargalos de IA (API Latency Isolation): O tempo médio de resposta para a geração de relatórios, resumos e análise semântica por LLMs parceiras (como Google Gemini e OpenAI) varia de 1 a 4 segundos. Executar essas operações de forma síncrona bloquearia as threads de execução do servidor web.
Tolerância Absoluta a Falhas e Indisponibilidade de Terceiros: Caso a API do WhatsApp ou do Google Gemini passe por instabilidades, as mensagens recebidas e tarefas não são perdidas; elas permanecem persistidas com segurança nas filas para retentativa controlada.
2. Topologia e Isolamento Físico de Banco (Redis)
Conforme estabelecido no documento de cache (06-arquitetura-cache.md), o Redis opera de forma logicamente isolada por contextos. Todas as estruturas e metadados de controle de filas do BullMQ rodam de forma exclusiva na instância do Redis DB 1.

                           [ API GATEWAY / FASTIFY ]
                                      │
                         (Recebe Webhook WhatsApp)
                                      │  ( < 50ms )
                                      ▼
                        [ PRODUTOR: Ingestion Service ]
                                      │
                    Push Job (Payload Bruto + Tenant ID)
                                      │
                                      ▼
                      ┌──────────────────────────────┐
                      │    REDIS DB 1 - QUEUE BUS    │
                      │                              │
                      │  ├─ 📦 whatsapp-ingestion    │
                      │  ├─ 📦 intelligence-pipeline │
                      │  └─ 📦 customer-notification │
                      └──────────────┬───────────────┘
                                     │
                 ┌───────────────────┼───────────────────┐
                 │                   │                   │
                 ▼                   ▼                   ▼
          [ WORKER 1 ]        [ WORKER 2 ]        [ WORKER 3 ]
       WhatsApp Ingestor     AI Orchestrator    Notifier Service
3. Catálogo de Filas do Sistema
O VendoraAI opera com três filas principais de processamento, cada uma com características de concorrência, prioridade e persistência ajustadas aos seus requisitos não funcionais.

3.1. Fila: whatsapp-ingestion
Propósito: Receber, sanitizar e salvar localmente todas as interações brutas de mensagens enviadas via Webhook do WhatsApp Business Cloud API.
Concorrência Padrão por Instância: 50 workers concorrentes.
Prioridade: Alta (Garante que o cliente não sinta atrasos na recepção visual das mensagens).
Payload do Job:
{
  "provider_message_id": "wamid.HBgMNTU0Nzk5OTk5OTk5Fgo=",
  "tenant_id": "tenant_dev_12345",
  "timestamp": 1786063200,
  "payload": { ... }
}
3.2. Fila: intelligence-pipeline
Propósito: Executar o pipeline pesado de inteligência (Extração semântica de motivos de perda, geração de rascunhos de respostas, indexação de vetores em pgvector e cálculo de SLA útil).
Concorrência Padrão por Instância: 5 a 10 workers concorrentes (Limitado pelo rate limit das chaves de API da LLM).
Prioridade: Média.
Payload do Job:
{
  "lead_id": "lead_98765",
  "tenant_id": "tenant_dev_12345",
  "task_type": "SEMANTIC_ANALYSIS_AND_EMBEDDING",
  "message_id": "msg_001_xyz"
}
3.3. Fila: customer-notification
Propósito: Processar envios de notificações ativas para o painel do vendedor via WebSockets ou disparos de webhooks de integração de saída para CRMs do cliente.
Concorrência Padrão por Instância: 20 workers concorrentes.
Prioridade: Média-Baixa.
Payload do Job:
{
  "tenant_id": "tenant_dev_12345",
  "event": "lead.cooling_alert",
  "recipient_user_id": "usr_998877",
  "notification_payload": { ... }
}
4. Estratégias de Resiliência: Backoff, Limites e DLQ
Para mitigar problemas transitórios sem saturar os recursos do sistema, todos os workers do BullMQ seguem regras rígidas de retentativas baseadas em Exponential Backoff com Jitter e destinação para Dead Letter Queue (DLQ).

 [ Job Executando ] ────(Erro Transitório)────► [ Aguarda Backoff Exponencial ]
         │                                               │
         │ (Sucesso)                                     │ (Tenta novamente até Max)
         ▼                                               ▼
 [ Arquiva Job ]                                [ Estourou Limite de Tentativas ]
                                                         │
                                                         ▼
                                               [ Move para DLQ / Alerta ]
4.1. Configuração de Retentativas por Tipo de Fila
Nome da Fila	Máx. Tentativas	Estratégia de Backoff	Tempo Inicial	Comportamento em Caso de Falha Permanente
whatsapp-ingestion	5	Exponencial	500 ms	Move para DLQ e gera alerta de severidade ALTA.
intelligence-pipeline	3	Exponencial	2000 ms	Move para DLQ, desativa enriquecimento de IA para a mensagem e marca lead para auditoria manual.
customer-notification	3	Fixo	5000 ms	Exclui o Job silenciosamente para evitar acúmulo de notificações defasadas em tela.
4.2. Implementação Técnica do Worker NestJS (Exemplo de Ingestão)
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Inject } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Processor('whatsapp-ingestion', {
  concurrency: 50,
  limiter: {
    max: 1000,
    duration: 1000 // Máximo 1000 webhooks por segundo por nó para proteger o Postgres
  }
})
export class WhatsAppIngestionWorker extends WorkerHost {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
  ) {
    super();
  }

  async process(job: Job<any, any, string>): Promise<any> {
    const { tenant_id, payload, provider_message_id } = job.data;

    try {
      // 1. Evita duplicidade (idempotência do webhook)
      const existingMsg = await this.prisma.message.findUnique({
        where: { provider_message_id }
      });
      if (existingMsg) return { status: 'skipped_duplicated' };

      // 2. Transação rápida de persistência local da mensagem
      return await this.prisma.$transaction(async (tx) => {
        const msg = await tx.message.create({
          data: {
            provider_message_id,
            tenant_id,
            raw_content: payload.text,
            direction: 'INBOUND',
            status: 'RECEIVED'
          }
        });

        // 3. Ao finalizar, despacha evento interno para o pipeline de IA processar assincronamente
        // em outra fila de menor prioridade
        return { message_id: msg.id, status: 'ingested' };
      });
    } catch (error) {
      // O erro é relançado para que o BullMQ acione o backoff exponencial configurado
      throw error;
    }
  }
}
5. Multi-Tenancy e Controle de Abuso (Fair Queueing)
Um dos maiores riscos em arquiteturas multi-tenant de alto tráfego é o cenário do Noisy Neighbor (Vizinho Barulhento): um único Tenant realiza uma ação em massa que gera milhares de jobs concorrentes de uma só vez, ocupando todos os workers e impedindo que as mensagens de outros Tenants menores sejam processadas.

Para garantir equidade (Fair Queueing) nas filas do VendoraAI, adotamos as seguintes estratégias técnicas no BullMQ:

5.1. Isolamento Dinâmico de Grupos de Jobs (Job Groups/Prefixes)
Em vez de criarmos uma fila física no Redis para cada cliente do sistema (o que geraria milhares de conexões e overhead de memória), utilizamos uma única fila física dividida virtualmente por chaves.
Configuramos o BullMQ para usar Parent-Child Job Relations ou limitadores dinâmicos por Tenant utilizando o cabeçalho do ID do cliente (tenant_id) como o identificador da chave de rate limit interna do BullMQ.
5.2. Rate Limit Dinâmico por Tenant
O BullMQ permite limitar dinamicamente a velocidade de consumo por chaves de Tenant. Definimos limites estritos de concorrência com base nos planos contratados (de 03-regras-de-negocio.md):
// Configuração de envio de Jobs garantindo o isolamento de concorrência por plano do Tenant
await queue.add(
  'process-ia',
  { tenant_id, data },
  {
    // Limita o rate do job por chave de grupo baseada no ID do Tenant
    // Impedindo que um cliente gaste a capacidade inteira do Worker da LLM
    groupId: `tenant_group:${tenant_id}`,
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000
    }
  }
);
6. Integração com IA (Model Routing & Rate Limits)
O processamento das LLMs na fila intelligence-pipeline exige gerenciamento estrito de vazão devido aos limites de requisições por minuto (RPM) e tokens por minuto (TPM) impostos pelas chaves de API da Google Gemini Cloud.

Para evitar erros de HTTP 429 (Too Many Requests) nas chamadas de IA:

Rate Limiter Centralizado no BullMQ: O worker de inteligência possui um rate limiter configurado estritamente para não estourar o limite da API do Gemini 1.5 Flash (ex: limite físico de 15 requisições por segundo para a chave de API de produção).
Fallback de Modelos Dinâmico: Se um job de análise de IA falhar de forma recorrente com erro de quota excedente (429), a lógica interna do worker intercepta o erro no loop de retentativas e chaveia o payload de forma transparente para um modelo de backup (ex: alternar do Gemini Flash para o OpenAI GPT-4o-Mini), registrando a alteração na auditoria de custos para faturamento posterior.
7. Monitoramento da Saúde das Filas (Observabilidade)
A saúde do ecossistema de filas do VendoraAI é auditada em tempo real por meio de duas ferramentas complementares:

Painel Administrativo Visual (Bull-Board): Uma interface gráfica montada sob rotas administrativas seguras (/admin/queues) do backend NestJS, que permite aos engenheiros inspecionar e reprocessar manualmente jobs que falharam e foram enviados para a DLQ.
Métricas do Prometheus: Exportamos métricas vitais a cada 15 segundos para gerar alertas preventivos no Grafana:
bullmq_active_jobs: Quantidade de tarefas em execução física.
bullmq_waiting_jobs: Tamanho da fila de espera. Indica gargalos na escalabilidade horizontal de workers.
bullmq_failed_jobs: Taxa de jobs que falharam. Alertas automáticos disparam se a taxa exceder 2% de falhas contínuas por 5 minutos.