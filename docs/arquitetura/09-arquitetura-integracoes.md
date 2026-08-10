09. Arquitetura de Integrações
Este documento define os padrões, contratos, protocolos de segurança e estratégias de resiliência para todas as integrações externas do VendoraAI. Para que o sistema opere com alta disponibilidade, baixa acoplagem e proteção jurídica sob a LGPD, nenhuma integração direta com APIs de terceiros deve tocar o núcleo (Core) da aplicação de forma síncrona ou sem blindagem arquitetural.

1. Abstração por Ports & Adapters (Clean Architecture)
Para evitar que mudanças de contratos ou depreciações de APIs de terceiros quebrem as regras de negócio do VendoraAI, adotamos o padrão Ports & Adapters (Hexagonal). Toda comunicação externa é isolada por portas (interfaces no domínio) e implementada por adaptadores específicos na camada de infraestrutura.

+--------------------------------------------------------------------------+
|                        INFRAESTRUTURA (ADAPTERS)                         |
|                                                                          |
|  +------------------+     +------------------+     +------------------+  |
|  | WhatsAppAdapter  |     |   AsaasAdapter   |     |  GeminiAdapter   |  |
|  +--------+---------+     +--------+---------+     +--------+---------+  |
|           |                        |                        |            |
+-----------|------------------------|------------------------|------------+
            | (implementa)           | (implementa)           | (implementa)
+-----------|------------------------|------------------------|------------+
|           v                        v                        v            |
|  +------------------+     +------------------+     +------------------+  |
|  |  WhatsAppPort    |     |   PaymentPort    |     |  LLMServicePort  |  |
|  |   (Interface)    |     |   (Interface)    |     |   (Interface)    |  |
|  +------------------+     +------------------+     +------------------+  |
|                                                                          |
|                             DOMÍNIO / CORE                               |
+--------------------------------------------------------------------------+
Exemplo de Definição de Porta (Domain)
// src/domain/ports/whatsapp.port.ts
export interface SendMessagePayload {
  to: string;
  tenantId: string;
  messageId: string;
  content: {
    text?: string;
    templateName?: string;
    variables?: string[];
  };
}

export interface WhatsAppPort {
  sendMessage(payload: SendMessagePayload): Promise<{ providerMessageId: string }>;
  downloadMedia(mediaId: string, tenantId: string): Promise<Buffer>;
}
2. WhatsApp Business Cloud API (Meta)
O WhatsApp é o canal primário de recepção de leads do VendoraAI. A integração com a Meta é dividida em dois fluxos complementares: Ingestão Assíncrona de Webhooks e Envio e Download de Mídias via API.

2.1 Ingestão Resiliente de Webhooks (WhatsApp -> VendoraAI)
As requisições enviadas pelos servidores da Meta batem diretamente no endpoint leve do Fastify (POST /v1/webhooks/whatsapp), que apenas autentica, valida e enfileira o payload bruto em filas do BullMQ para processamento assíncrono.

Meta Server -> [API Gateway (Rate Limiter)] -> [Fastify Webhook Endpoint]
                                                          |
                                           (Gera tarefa em < 50ms)
                                                          v
                                                  [Redis / BullMQ]
                                                          |
                                           (Processamento Assíncrono)
                                                          v
                                                   [Ingestion Job]
Validação de Assinatura (X-Hub-Signature-256)
Para garantir que a requisição partiu estritamente dos servidores da Meta, o Fastify valida a assinatura criptográfica SHA-256 enviada no cabeçalho x-hub-signature-256 utilizando o segredo do aplicativo (App Secret) configurado nas variáveis de ambiente.

// src/infrastructure/adapters/whatsapp/whatsapp-webhook.guard.ts
import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import * as crypto from 'crypto';

@Injectable()
export class WhatsAppWebhookGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const signature = request.headers['x-hub-signature-256'] as string;
    const rawBody = request.rawBody; // Requer Fastify configurado para manter o rawBody em buffer

    if (!signature) {
      throw new UnauthorizedException('Missing signature header.');
    }

    const appSecret = process.env.WHATSAPP_APP_SECRET;
    if (!appSecret) {
      throw new Error('WHATSAPP_APP_SECRET is not defined.');
    }

    const [, hash] = signature.split('=');
    const expectedHash = crypto
      .createHmac('sha256', appSecret)
      .update(rawBody)
      .digest('hex');

    if (hash !== expectedHash) {
      throw new UnauthorizedException('Invalid payload signature.');
    }

    return true;
  }
}
Idempotência de Mensagens por wamid
Os webhooks da Meta possuem uma política agressiva de retentativa se o nosso servidor falhar em responder com HTTP 200 dentro de 3 segundos. Para evitar o reprocessamento de mensagens duplicadas:

O backend extrai o ID único da mensagem do WhatsApp (wamid).
Antes de processar, realiza uma validação atômica no Redis utilizando um bloqueio distribuído (SETNX) com a chave whatsapp:msg:${wamid} e TTL de 24 horas.
Se o retorno for 0, a mensagem já foi enfileirada ou processada anteriormente, sendo descartada imediatamente.
// src/infrastructure/adapters/whatsapp/idempotency.service.ts
import { Injectable } from '@nestjs/common';
import { RedisService } from '../../cache/redis.service';

@Injectable()
export class IdempotencyService {
  constructor(private readonly redis: RedisService) {}

  async isDuplicate(wamid: string): Promise<boolean> {
    const key = `whatsapp:msg:${wamid}`;
    // Tenta definir a chave apenas se não existir (SETNX) com TTL de 86400 segundos (24 horas)
    const acquired = await this.redis.getClient().set(key, '1', 'EX', 86400, 'NX');
    return acquired === null; // Se retornar nulo, a chave já existia (duplicada)
  }
}
2.2 Processamento de Mídias (Áudio, Imagem e Documentos)
O VendoraAI não processa mídias em tempo real. Quando um lead envia um áudio, imagem ou PDF, o payload do webhook contém apenas o media_id do servidor da Meta.

Enfileiramento: O media_id é capturado e enviado para a fila media-processing.
Download: O worker da fila consome o item, chama a API da Meta para recuperar a URL temporária de download e baixa os dados brutos de mídia em buffers de memória.
Persistência Segura: O arquivo é transferido imediatamente para o Storage do sistema (S3 / Cloudflare R2) em uma pasta isolada por Tenant com criptografia em repouso.
Transcrição de Áudios: Se a mídia for do tipo áudio, uma tarefa secundária é enviada para a API do Whisper (OpenAI) ou Gemini Multimodal para extrair o texto completo, integrando-o ao histórico textual da conversa para análise semântica e cálculo de sentimentos.
3. Provedores de Inteligência Artificial (Gemini e OpenAI)
Toda a orquestração de chamadas de LLM é centralizada pelo Vercel AI SDK, rodando na infraestrutura do NestJS.

3.1 Roteamento Dinâmico e Estratégia de Fallback
O VendoraAI opera sob um modelo híbrido para controle estrito de custos (SLA de custos e tokens):

Provedor Primário: Google Gemini 1.5 Flash (via @ai-sdk/google), escolhido pelo baixíssimo custo por milhão de tokens, velocidade de geração e gigantesca janela de contexto (ideal para ler históricos longos de WhatsApp).
Provedor de Fallback: OpenAI GPT-4o-mini (via @ai-sdk/openai), acionado automaticamente em cenários de exaustão de cota de requisições por minuto (RPM/TPM) ou instabilidade nos servidores do Google Cloud Core.
// src/infrastructure/adapters/ai/llm-router.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { google } from '@ai-sdk/google';
import { openai } from '@ai-sdk/openai';
import { generateText, LanguageModel } from 'ai';

@Injectable()
export class LLMRouterService {
  private readonly logger = new Logger(LLMRouterService.name);

  getModel(provider: 'gemini' | 'openai' = 'gemini'): LanguageModel {
    if (provider === 'openai') {
      return openai('gpt-4o-mini');
    }
    return google('gemini-1.5-flash');
  }

  async generateTextWithFallback(prompt: string, systemInstruction: string): Promise<string> {
    try {
      // Tenta provedor primário (Gemini)
      const { text } = await generateText({
        model: this.getModel('gemini'),
        prompt,
        systemInstruction,
        maxTokens: 500,
        temperature: 0.1, // Baixa temperatura para garantir determinismo e reduzir alucinações
      });
      return text;
    } catch (error) {
      this.logger.error('Gemini API failed, routing to OpenAI GPT-4o-mini', error.stack);

      // Fallback robusto para OpenAI
      const { text } = await generateText({
        model: this.getModel('openai'),
        prompt,
        systemInstruction,
        maxTokens: 500,
        temperature: 0.1,
      });
      return text;
    }
  }
}
3.2 Timeouts Rígidos e Limites de Conexão
Para cumprir o requisito não funcional de latência máxima de IA (RNF-03 - resposta em menos de 4 segundos):

Toda chamada externa de LLM possui um limitador de tempo de execução (Timeout) de 3.000ms (3 segundos). Se a API de IA falhar em responder dentro dessa janela, a requisição é abortada e uma resposta padrão simplificada baseada em heurísticas locais é gerada (Gracious Degradation).
Toda conexão é fechada de forma limpa sem deixar conexões órfãs (Socket Leaks).
4. Gateway de Pagamentos e Assinaturas (Asaas / Stripe)
O faturamento do VendoraAI opera como SaaS de cobrança recorrente mensal estruturada em planos. A integração com o gateway de pagamento (preferencialmente Asaas pelo suporte nativo e maduro ao ecossistema Pix brasileiro) é estruturada em torno de cobranças atômicas e notificações de alteração de ciclo de vida de assinaturas.

4.1 Ciclo de Sincronização de Assinaturas (Webhooks do Gateway)
O backend do VendoraAI mantém a tabela Tenant e suas respectivas regras de cobrança em total sincronia com o gateway de pagamento através de um pipeline assíncrono acionado por WebSockets e Webhooks de Billing.

Asaas Gateway -> [Fastify Webhook Gateway Endpoint]
                                |
               (Valida assinatura criptográfica)
                                |
                   [BullMQ: Billing-Processor]
                                |
         +----------------------+----------------------+
         |                                             |
         v                                             v
  [Pagamento Confirmado]                        [Inadimplência / Cancelamento]
         |                                             |
  Atualiza Tenant para ACTIVE                    Atualiza Tenant para OVERDUE / SUSPENDED
  Libera cotas de uso no Redis                   Bloqueia acesso do painel do lojista
Eventos Críticos Mapeados
PAYMENT_RECEIVED / invoice.payment_succeeded: Confirmação do pagamento mensal. Desbloqueia as cotas de consumo do Tenant e reseta os contadores de tokens no cache do Redis.
PAYMENT_OVERDUE / invoice.payment_failed: Pagamento vencido. Aciona a regra de negócio RN-COB-05, colocando a conta do Tenant em modo Grace Period por 3 dias úteis antes de suspender.
SUBSCRIPTION_DELETED / customer.subscription.deleted: Cancelamento da conta. Bloqueia o envio de webhooks e marca o Tenant para desativação completa no fim do período de faturamento vigente.
4.2 Segurança de Ingestão e Validação de Token de Tokenização (Billing Token)
Assim como no fluxo do WhatsApp, os webhooks do Asaas ou Stripe necessitam de autenticação estrita para mitigar ataques de inserção de crédito falso:

Asaas: O webhook valida a assinatura enviada no cabeçalho asaas-access-token, cruzando-o com o hash privado configurado no painel da aplicação.
Stripe: O SDK oficial do Stripe é utilizado para ler e validar o buffer cru (rawBody) juntamente com a assinatura stripe-signature e o segredo de webhook do Stripe (whsec_...).
// src/infrastructure/adapters/billing/stripe-webhook.guard.ts
import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import Stripe from 'stripe';

@Injectable()
export class StripeWebhookGuard implements CanActivate {
  private stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2023-10-16' });

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const signature = request.headers['stripe-signature'] as string;
    const rawBody = request.rawBody;

    if (!signature) {
      throw new UnauthorizedException('Missing stripe signature.');
    }

    try {
      const event = this.stripe.webhooks.constructEvent(
        rawBody,
        signature,
        process.env.STRIPE_WEBHOOK_SECRET
      );
      request.billingEvent = event; // Disponibiliza o evento tipado para o controller
      return true;
    } catch (err) {
      throw new UnauthorizedException(`Webhook Signature verification failed: ${err.message}`);
    }
  }
}
5. Resiliência de Redes (Políticas de Retry e Fallback)
Integrações sofrem com instabilidade temporária. Todas as saídas de rede (Outbound Connections) do backend do VendoraAI utilizan uma política unificada de resiliência baseada em um interceptor global utilizando o padrão Circuit Breaker (Disjuntor de Redes).

5.1 Parâmetros de Disjuntor (Circuit Breaker)
Failure Threshold: Se mais de 5 chamadas consecutivas para um serviço falharem ou retornarem erro 5xx, o circuito é "Aberto".
Open Circuit State: Durante o circuito aberto, todas as tentativas subsequentes de chamada são abortadas imediatamente no backend (sem bater na rede), poupando recursos do servidor e acionando fallbacks locais instantâneos.
Half-Open Timer: Após 30 segundos com o circuito aberto, o sistema passa para o estado "Meio Aberto", permitindo uma requisição de teste. Se for bem-sucedida, o circuito se "Fecha" novamente; se falhar, retorna ao estado "Aberto".
// Parâmetros padrão do Circuit Breaker implementados via Axios/Got interceptors
export const CircuitBreakerConfig = {
  whatsapp: {
    timeout: 3000,          // 3 segundos limite de conexão
    maxFailures: 5,         // Limite de erros antes de abrir circuito
    resetTimeout: 30000,    // 30 segundos no estado aberto antes de testar
  },
  billing: {
    timeout: 5000,          // Gateways de cobrança toleram até 5s
    maxFailures: 3,
    resetTimeout: 15000,
  }
};
5.2 Estratégias de Degradação Graciosa (Graceful Degradation)
Se a integração principal falhar, o VendoraAI garante o funcionamento essencial do ecossistema do cliente:

Integração	Sintoma de Falha	Ação de Contingência / Fallback
WhatsApp API	Queda dos servidores da Meta	Retentativa assíncrona por 24 horas usando filas do BullMQ com backoff exponencial. Alerta visual no painel do vendedor sobre atrasos de sincronia com a operadora.
Whisper API (Transcrição)	Falha ao transcrever áudio recebido	O lead é notificado ou o áudio é marcado na tela com o status "Transcrição indisponível temporariamente". O vendedor pode ouvir o áudio diretamente pela UI do React via player de áudio nativo integrado ao Storage.
LLM Provedor (Gemini)	Estouro de TPM / Indisponibilidade	Chaveamento automático imediato em menos de 100ms para a API da OpenAI (GPT-4o-mini).
Gateway de Pagamentos	Queda do Asaas / Stripe	Webhooks do webhook-receiver guardam o payload bruto na fila persistente no Redis para consolidação assíncrona assim que a conexão se restabelecer. Nenhuma conta é bloqueada por atraso de recebimento de webhook.
6. Matriz de Mapeamento de Integrações e Segurança
Para fins de governança de segurança, LGPD e limites de consumo, cada fluxo de rede externa do VendoraAI obedece rigorosamente às seguintes diretrizes:

Direção	Integração / Destino	Protocolo / Porta	Dados Trafegados	Mecanismo de Proteção
Inbound	WhatsApp Cloud API	HTTPS (443)	Payloads de conversas de leads, status de mensagens.	Validação SHA-256 do webhook, Idempotência no Redis via wamid.
Inbound	Gateway de Pagamento	HTTPS (443)	Status de assinaturas, logs de pagamento.	Assinatura HMAC criptográfica privada do gateway no header.
Outbound	Google Cloud Core / OpenAI	HTTPS (443)	Mensagens higienizadas para geração de resumos/RAG.	Pre-flight Sanitizer obrigatório. Nenhuma informação de PII (CPF, CNPJ, Telefone) é enviada para as LLMs.
Outbound	Cloudflare R2 / AWS S3	HTTPS (443)	Gravações de áudio e mídias de leads de Tenants.	Criptografia nativa em repouso (SSE-S3), URLs assinadas temporárias para leitura.