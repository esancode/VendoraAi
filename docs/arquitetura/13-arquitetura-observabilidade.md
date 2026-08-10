Arquitetura de Observabilidade (Telemetria, Logs e Métricas)
Este documento especifica a arquitetura de Observabilidade e Telemetria do VendoraAI. Sob os princípios de Simplicidade Radical e Custo-Eficiência, o sistema implementa um modelo de monitoramento distribuído que unifica a coleta de logs, métricas do sistema, telemetria de Inteligência Artificial e o estado de filas assíncronas, garantindo alta disponibilidade sem onerar a performance da aplicação e mantendo estrita conformidade com a privacidade de dados (LGPD).

1. Visão Geral e Objetivos
O monitoramento de um sistema altamente assíncrono e integrado a múltiplos serviços de IA (como o VendoraAI) exige uma abordagem ativa para detectar falhas antes que elas impactem os vendedores na Single Page Application (SPA). A arquitetura de observabilidade visa:

Garantir o SLA de Performance: Monitorar as restrições estritas de latência estabelecidas no 02-requisitos.md (ingestão de Webhooks < 2s e resposta de IA < 4s).
Prevenir Vazamento de Custos de IA: Monitorar o consumo dinâmico de tokens por tenant em tempo real (03-regras-de-negocio.md), prevenindo abusos e automatizando o rate limiting de uso.
Visibilidade do Pipeline Assíncrono: Acompanhar a transição de estados de jobs no BullMQ (arquitetura-07-arquitetura-filas.md) para detectar gargalos ou enfileiramento excessivo de mensagens do WhatsApp.
Privacidade por Design (LGPD): Garantir que nenhum dado pessoal identificável (PII) que tenha sido mascarado pelo pipeline do Pre-flight Sanitizer escape de forma inadvertida em logs de depuração física (arquitetura-08-arquitetura-ia.md).
2. Os Três Pilares da Observabilidade
                +-----------------------------------------------+
                |            APLICAÇÃO NESTJS / FASTIFY         |
                +------------------+---------+------------------+
                                   |         |
         +-------------------------+         +-------------------------+
         | (Logs JSON)             | (Métricas Prometheus)             | (Tracing OTLP)
         v                         v                                   v
+------------------+     +------------------+                +------------------+
|      PINO        |     |    PROMETHEUS    |                |   OPENTELEMETRY  |
|  (Stdout Local)  |     |  (/metrics HTTP) |                |     (Jaeger)     |
+--------+---------+     +--------+---------+                +--------+---------+
         |                        |                                   |
         v                        v                                   v
+--------+---------+     +--------+---------+                +--------+---------+
|     LOKI /       |     |    PROMETHEUS    |                |     JAEGER /     |
|   OPENSEARCH     |     |     (SERVER)     |                |      TEMPO       |
+--------+---------+     +--------+---------+                +--------+---------+
         |                        |                                   |
         +------------------------+-----------------------------------+
                                  |
                                  v
                       +--------------------+
                       | GRAFANA DASHBOARDS |
                       +--------------------+
2.1. Logs Estruturados (Structured Logging)
O monólito modular utiliza a biblioteca Pino integrada ao NestJS para geração de logs em formato JSON padronizado enviado diretamente para o stdout. Pino foi selecionada devido à sua baixíssima sobrecarga de CPU e alocação de memória RAM quase zero (até 5x mais rápido que Winston).

Diretrizes de Logging:
Sem Escrita de Arquivo Física local: Todos os logs são gravados no fluxo stdout/stderr do contêiner Docker, delegando a coleta de logs para agentes externos (como Promtail, FluentBit ou Vector) que centralizam a informação no Grafana Loki ou OpenSearch.
Filtro de PII Ativo (LGPD): O utilitário de log do Pino utiliza uma lista negra de sanitização automática de chaves (redact) para garantir que dados como cpf, cnpj, email, telephone e password sejam automaticamente mascarados caso vazem acidentalmente em payloads de erro de validação.
Campos Obrigatórios por Linha de Log:
timestamp: Formato ISO 8601 UTC.
level: Identificação do nível de log em numeração padronizada (Ex: 30 = INFO, 50 = ERROR).
tenant_id: String UUID do Tenant ativo, se presente no contexto de execução do thread.
trace_id e span_id: IDs do OpenTelemetry para correlação de logs com requisições HTTP ou processamento de filas específicas.
context: Módulo/Serviço do NestJS que disparou o registro (Ex: WhatsAppWebhookAdapter).
Exemplo de Entrada de Log Estruturado:
{
  "level": 50,
  "time": "2026-08-07T22:23:51.123Z",
  "pid": 12,
  "hostname": "backend-monolith-5f7bd",
  "context": "AIIntelligenceOrchestrator",
  "tenant_id": "893c528f-7c18-4903-a1bf-53a5c10be19b",
  "trace_id": "4bf92f3577b34da6a3ce929d0e0e4736",
  "span_id": "00f067aa0ba902b7",
  "message": "Erro na chamada do modelo principal do Gemini - Limite de quota excedido",
  "error": {
    "message": "Resource has been exhausted (e.g. check quota).",
    "code": "RESOURCE_EXHAUSTED",
    "stack": "Error: Resource has been exhausted... at GeminiProvider.generateResponse..."
  }
}
2.2. Métricas de Sistema e Negócio
As métricas são expostas em formato nativo do Prometheus através de uma rota restrita /metrics gerenciada pelo pacote @willsoto/nestjs-prometheus operando no Fastify.

Métricas do Runtime (NodeJS): Uso de memória Heap, estatísticas de Garbage Collector, contagem de event loop lag e utilização ativa de CPU.
Métricas do Banco de Dados PostgreSQL: Pool de conexões ativas do Prisma, latência de execução de queries ACID e erros gerados pelo Row-Level Security (RLS).
Métricas de Infraestrutura (Redis & BullMQ): Consumo de memória Redis, latência de operações, tamanho das filas e taxa de falhas na execução de tarefas do BullMQ.
2.3. Rastreamento Distribuído (Distributed Tracing)
Para diagnosticar gargalos de latência em operações que cruzam múltiplos contextos, o VendoraAI implementa o padrão OpenTelemetry (OTel).

Tracing E2E: Um trace se inicia assim que um webhook do WhatsApp entra no API Gateway, recebe um trace_id e percorre o enfileiramento no BullMQ, processamento no worker, chamada do banco de dados relacional e a requisição final do Vercel AI SDK de volta ao WhatsApp.
Propagação de Contexto: Os IDs de traces são propagados através de cabeçalhos W3C Trace Context (traceparent) em requisições de microsserviços ou metadados de jobs do Redis.
3. Catálogo de Métricas Críticas (Métricas Customizadas)
Para monitorar com precisão os gargalos inerentes ao VendoraAI, a equipe de engenharia instrumenta e expõe as seguintes métricas customizadas no Prometheus:

Nome da Métrica	Tipo	Descrição	Marcadores (Labels)
vendora_http_request_duration_seconds	Histogram	Latência de requisições HTTP recebidas	method, route, status_code
vendora_whatsapp_ingestion_latency_seconds	Histogram	Tempo decorrido entre o envio do cliente e o salvamento em banco	tenant_id, status
vendora_ai_inference_duration_seconds	Histogram	Latência de chamadas à LLM para RAG/Resumos	tenant_id, provider, model, status
vendora_ai_tokens_consumed_total	Counter	Total de tokens acumulados consumidos	tenant_id, model, type (prompt/completion)
vendora_ai_errors_total	Counter	Total de falhas em chamadas de IA	provider, model, error_code
vendora_bullmq_job_state_count	Gauge	Quantidade de jobs ativos em cada fila do BullMQ	queue_name, state (waiting, active, failed, completed)
vendora_circuit_breaker_state	Gauge	Estado do Circuit Breaker de integrações (0=Closed, 1=HalfOpen, 2=Open)	integration_name
vendora_redis_cache_hits_total	Counter	Quantidade de acertos no cache Redis	tenant_id, cache_namespace
vendora_redis_cache_misses_total	Counter	Quantidade de falhas de leitura no cache Redis	tenant_id, cache_namespace
vendora_postgres_rls_violations_total	Counter	Tentativas de acesso que violaram as políticas do Postgres RLS	tenant_id, table
vendora_lead_cooling_alerts_total	Counter	Alertas de lead esfriando que foram disparados	tenant_id, sla_type
4. Estrutura de Alertas e Níveis de Severidade
Os alertas de produção do VendoraAI são gerenciados pelo Prometheus Alertmanager e categorizados de acordo com o impacto operacional, garantindo que o time de engenharia de plantão seja acionado antes que ocorra degradação do serviço de vendas de PMEs.

+------------------+     +------------------+     +-------------------------------+
|    PROMETHEUS    | --> |   ALERTMANAGER   | --> | CANAIS DE NOTIFICAÇÃO (Slack, |
| (Regras de Alerta|     | (Agrupamento,    |     |  PagerDuty, Opsgenie, SMS)    |
|   e Condições)   |     | Deduplicação)    |     +-------------------------------+
+------------------+     +------------------+
4.1. Nível 1: SEVERIDADE CRÍTICA (P0 - Acionamento Imediato de Plantão)
Critério de Impacto: Falha total do sistema ou quebra imediata de SLAs contratuais de alto nível.
Canais de Disparo: PagerDuty (ligação por voz/SMS) e canal #ops-alerts-criticos no Slack.
Regras de Alerta do Prometheus:
groups:
  - name: Alertas_Criticos_P0
    rules:
      # Ingestão de Webhook WhatsApp falhando sistematicamente
      - alert: WhatsAppWebhookIngestionFailureRateHigh
        expr: sum(rate(vendora_http_request_duration_seconds_count{route="/webhooks/whatsapp", status_code=~"5.."}[5m])) / sum(rate(vendora_http_request_duration_seconds_count{route="/webhooks/whatsapp"}[5m])) * 100 > 5
        for: 2m
        labels:
          severity: critical
        annotations:
          summary: "Taxa de erro 5XX no webhook do WhatsApp acima de 5% nos últimos 2 minutos."
          description: "Os webhooks enviados pela Meta estão falhando ao serem recebidos no monólito. Isso pode resultar em perda permanente de mensagens comerciais de leads ativos de Tenants."

      # Fila de Ingestão de Mensagens acumulando excessivamente
      - alert: IngestionQueueSizeSpike
        expr: vendora_bullmq_job_state_count{queue_name="whatsapp-ingestion", state="waiting"} > 2000
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "Fila de ingestão de mensagens com tamanho crítico."
          description: "Há mais de 2.000 mensagens aguardando processamento na fila 'whatsapp-ingestion'. Isso causará lentidão na entrega em tempo real de mensagens na SPA dos vendedores."

      # Violação de Isolamento de RLS no PostgreSQL (Suspeita de Invasão/Falha)
      - alert: PostgresRLSViolationAttempt
        expr: increase(vendora_postgres_rls_violations_total[1m]) > 0
        labels:
          severity: critical
        annotations:
          summary: "VIOLAÇÃO DE ROW-LEVEL SECURITY DETECTADA NO POSTGRESQL."
          description: "Ocorreu uma tentativa de consultar dados de um Tenant usando uma credencial ou sessão incompatível. Possível tentativa de IDOR ou bug crítico de vazamento de contexto."
4.2. Nível 2: SEVERIDADE ALTA (P1 - Atendimento no mesmo dia)
Critério de Impacto: Degradação significativa de performance ou falha em integrações secundárias.
Canais de Disparo: Discord/Slack Channel #ops-alerts-warnings.
Regras de Alerta do Prometheus:
      # Latência de Processamento de IA superior a 4 segundos
      - alert: AILatencyBreached
        expr: histogram_quantile(0.95, sum(rate(vendora_ai_inference_duration_seconds_bucket[5m])) by (le)) > 4.0
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Latência quantil 95% do processamento de Inteligência Artificial acima de 4 segundos."
          description: "O tempo de geração de rascunhos ou classificação de perdas está demorando acima do limite não funcional RNF-03 de 4 segundos."

      # Circuito de IA Aberto (Circuit Breaker acionado)
      - alert: AICircuitBreakerOpened
        expr: vendora_circuit_breaker_state{integration_name="openai_provider"} == 2
        for: 1m
        labels:
          severity: warning
        annotations:
          summary: "Circuit Breaker para a API da OpenAI foi ABERTO."
          description: "As requisições de fallback para a OpenAI atingiram a taxa máxima de falhas de rede e o fluxo foi interrompido localmente para proteger os recursos."
4.3. Nível 3: SEVERIDADE INFORMATIVA (P2 - Avaliação em horário comercial)
Critério de Impacto: Desvios estatísticos de uso, estofamento de cotas de plano do Tenant e avisos de custos.
Canais de Disparo: Relatórios por Email diários e painéis de controle do Grafana.
5. Estrutura dos Grafana Dashboards
Para dar visibilidade a equipe técnica sênior, o Grafana é configurado com dois painéis operacionais principais:

5.1. Dashboard Operacional (SRE / Infraestrutura)
Painel de Ingestão: Gráfico de linha mostrando o throughput de requisições de webhook no Fastify comparado com as execuções finalizadas com sucesso no BullMQ.
Tempo de Resposta E2E: Painel exibindo a latência de ponta a ponta (Ingestão + Sanitização + Banco + AI + WebSocket Push) distribuída nos quantis p50, p90 e p95.
Painel do Redis: Consumo real de RAM do Redis, métricas de fragmentação, conexões simultâneas de clientes e taxa de hit/miss de cache de Tenants.
Estatísticas Postgres: Conexões ativas no pool do Prisma ORM, consumo de conexões transacionais abertas e tempo das maiores queries no banco relacional.
5.2. Dashboard de Negócio e IA (FinOps / Engenharia de IA)
Painel de Modelos: Taxa de requisições enviadas ao Gemini 1.5 Flash vs fallbacks acionados ao GPT-4o-mini.
Controle de Custos e Orçamento (FinOps): Projeção mensal consolidada de despesas com APIs de IA com base no consumo agregado de tokens de Prompt/Completion e custos tabelados de cada LLM.
Distribuição de Consumo por Tenant: Gráficos do tipo bento-grid exibindo os 10 Tenants que mais consomem processamento e tokens no monólito, facilitando análises de abusos de cotas e redimensionamento de planos.
Acurácia de Classificação: Métricas exibindo a quantidade de vezes que o classificador de motivos de perda retornou um score de confiança abaixo do limite de 85%, encaminhando a decisão para aprovação manual do vendedor.
6. Implementação Prática: AIExecutionTelemetryInterceptor
Abaixo está a implementação prática de um Interceptor do NestJS que monitora e contabiliza a telemetria física, custos e latência de operações de IA de forma totalmente integrada aos logs estruturados do Pino e métricas do Prometheus:

import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { Counter, Histogram } from 'prom-client';
import { InjectMetric } from '@willsoto/nestjs-prometheus';

@Injectable()
export class AIExecutionTelemetryInterceptor implements NestInterceptor {
  private readonly logger = new Logger('AIExecutionTelemetry');

  constructor(
    @InjectMetric('vendora_ai_inference_duration_seconds')
    private readonly aiLatencyHistogram: Histogram<string>,

    @InjectMetric('vendora_ai_tokens_consumed_total')
    private readonly aiTokensCounter: Counter<string>,

    @InjectMetric('vendora_ai_errors_total')
    private readonly aiErrorsCounter: Counter<string>,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const startTime = process.hrtime();
    const httpContext = context.switchToHttp();
    const request = httpContext.getRequest();

    // Extrai o tenant_id injetado anteriormente pelo middleware de autenticação
    const tenantId = request.tenantId || 'anonymous';
    const provider = request.headers['x-ai-provider'] || 'gemini';
    const modelName = request.headers['x-ai-model'] || 'gemini-1.5-flash';

    return next.handle().pipe(
      tap((response) => {
        const elapsed = process.hrtime(startTime);
        const durationSeconds = elapsed[0] + elapsed[1] / 1e9;

        // 1. Registra a latência no histograma do Prometheus
        this.aiLatencyHistogram.observe(
          { tenant_id: tenantId, provider, model: modelName, status: 'success' },
          durationSeconds,
        );

        // 2. Registra o consumo real de tokens se retornado no payload estruturado
        if (response && response.usage) {
          const { promptTokens, completionTokens } = response.usage;

          this.aiTokensCounter.inc(
            { tenant_id: tenantId, model: modelName, type: 'prompt' },
            promptTokens || 0,
          );

          this.aiTokensCounter.inc(
            { tenant_id: tenantId, model: modelName, type: 'completion' },
            completionTokens || 0,
          );

          this.logger.log({
            message: 'Execução de Inteligência Artificial finalizada com sucesso',
            tenant_id: tenantId,
            provider,
            model: modelName,
            durationSeconds,
            promptTokens,
            completionTokens,
          });
        }
      }),
      catchError((error) => {
        const elapsed = process.hrtime(startTime);
        const durationSeconds = elapsed[0] + elapsed[1] / 1e9;

        // 1. Registra a latência de falha no histograma
        this.aiLatencyHistogram.observe(
          { tenant_id: tenantId, provider, model: modelName, status: 'failed' },
          durationSeconds,
        );

        // 2. Incrementa o contador de erros específicos
        const errorCode = error.code || 'UNKNOWN_ERROR';
        this.aiErrorsCounter.inc({
          provider,
          model: modelName,
          error_code: errorCode,
        });

        this.logger.error({
          message: 'Erro durante o processamento de Inteligência Artificial',
          tenant_id: tenantId,
          provider,
          model: modelName,
          durationSeconds,
          error: {
            message: error.message,
            code: errorCode,
            stack: error.stack,
          },
        });

        throw error;
      }),
    );
  }
}
7. Próximos Passos de Integração e Governança
Para validar e colocar a arquitetura de observabilidade em pleno funcionamento de forma sequencial com os próximos passos lógicos do projeto:

Configuração DevOps (docs/devops/04-monitoramento.md): Traduzir este modelo de dados em arquivos de provisionamento do Docker Compose e de configuração do Prometheus (prometheus.yml).
Alertas e Integrações (docs/devops/06-alertas.md): Desenvolver as rotas de webhook de integração com o Slack do time de engenharia de plantão para despacho automatizado dos alertas de P0.
Mapeamento de ADR (docs/adr/): Criar uma ADR formalizando o uso do ecossistema Pino + OpenTelemetry + Prometheus unificados como a biblioteca padrão de monitoramento de incidentes do backend core do VendoraAI.