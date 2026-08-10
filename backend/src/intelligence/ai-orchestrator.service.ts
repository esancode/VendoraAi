import { Injectable, Logger } from '@nestjs/common';
import { generateObject, generateText, tool } from 'ai';
import { z } from 'zod';
import { PrismaService } from '../prisma/prisma.service';
import { google, createGoogleGenerativeAI } from '@ai-sdk/google';
import { openai, createOpenAI } from '@ai-sdk/openai';
import { LossClassificationSchema, LossClassification } from './schemas/loss-classification.schema';
import { KnowledgeService } from './knowledge.service';
import { CryptoHelper } from '../common/utils/crypto.helper';

@Injectable()
export class AiOrchestratorService {
  private readonly logger = new Logger(AiOrchestratorService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly knowledgeService: KnowledgeService
  ) {}

  async analyzeConversation(conversationHistory: string, tenantId?: string): Promise<{
    classification: LossClassification;
    usage: any;
  }> {
    const systemPrompt = `
      Você é um especialista em vendas e assistente de IA focado em analisar conversas entre clientes e nossa empresa.
      Sua tarefa é analisar o histórico de conversa mascarado fornecido, determinar o status da negociação, as intenções do cliente e categorizar caso seja uma perda (LOST).
      
      Regras de Negócio:
      - O status "WON" só deve ser usado se o cliente confirmou o pagamento, finalizou a compra ou concordou explicitamente em prosseguir com o negócio fechado.
      - O status "LOST" deve ser usado se o cliente declinou explicitamente, desistiu, mencionou que achou caro (PRICE), que comprou no concorrente (COMPETITION), etc.
      - O status "ONGOING" deve ser usado para qualquer outra conversa ainda em andamento.
      - Se for LOST, preencha a reasonCategory adequadamente.
      - confidenceScore deve ser uma probabilidade (0.0 a 1.0) indicando quão claro está o desfecho.
      - unmappedDemands são produtos/recursos pedidos que não oferecemos.
    `;

    let googleModel = google('gemini-1.5-flash');
    let fallbackModel = openai('gpt-4o-mini');
    let hasByok = false;

    if (tenantId) {
      const tenant = await this.prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { customGeminiApiKey: true, customOpenAiApiKey: true }
      });
      if (tenant?.customGeminiApiKey) {
        const apiKey = CryptoHelper.decrypt(tenant.customGeminiApiKey);
        const customGoogle = createGoogleGenerativeAI({ apiKey });
        googleModel = customGoogle('gemini-1.5-flash');
        hasByok = true;
      }
      if (tenant?.customOpenAiApiKey) {
        const apiKey = CryptoHelper.decrypt(tenant.customOpenAiApiKey);
        const customOpenAI = createOpenAI({ apiKey });
        fallbackModel = customOpenAI('gpt-4o-mini');
        hasByok = true;
      }
    }

    try {
      this.logger.debug('Iniciando análise semântica da conversa com gemini-1.5-flash (Primário)');
      const result = await generateObject({
        model: googleModel,
        schema: LossClassificationSchema,
        system: systemPrompt,
        prompt: `Analise a seguinte conversa:\n\n${conversationHistory}`,
      });

      if (!hasByok && tenantId) {
        await this.prisma.tenant.update({
          where: { id: tenantId },
          data: { messagesProcessedThisMonth: { increment: 1 } }
        });
      }

      return {
        classification: result.object,
        usage: result.usage,
      };
    } catch (error) {
      this.logger.warn(`Falha na chamada ao modelo primário (Gemini): ${error.message}. Tentando modelo de fallback (gpt-4o-mini)...`);
      
      try {
        const fallbackResult = await generateObject({
          model: fallbackModel,
          schema: LossClassificationSchema,
          system: systemPrompt,
          prompt: `Analise a seguinte conversa:\n\n${conversationHistory}`,
        });

        if (!hasByok && tenantId) {
          await this.prisma.tenant.update({
            where: { id: tenantId },
            data: { messagesProcessedThisMonth: { increment: 1 } }
          });
        }
        
        return {
          classification: fallbackResult.object,
          usage: fallbackResult.usage,
        };
      } catch (fallbackError) {
        this.logger.error(`Falha no fallback: ${fallbackError.message}`);
        throw new Error('Falha em ambos os modelos de IA (Primário e Fallback)');
      }
    }
  }

  async generateReplyDraft(history: string, tenantId?: string, useTools: boolean = false, agentId?: string): Promise<string> {
    let agentContext = '';
    let messages: any[] = [];
    let temperature = 0.7;

    if (tenantId && agentId) {
      await this.prisma.runInTenantContext(tenantId, async (tx) => {
        const agent = await tx.agent.findUnique({
          where: { id: agentId },
          include: { examples: { orderBy: { createdAt: 'asc' } } },
        });

        if (agent) {
          temperature = Number(agent.temperature) || 0.7;
          
          let onboardingText = 'Nenhum contexto informado.';
          if (agent.onboardingAnswers && typeof agent.onboardingAnswers === 'object' && !Array.isArray(agent.onboardingAnswers)) {
            const answersObj = agent.onboardingAnswers as Record<string, any>;
            onboardingText = Object.entries(answersObj)
              .map(([key, value]) => `- ${key}: ${value}`)
              .join('\n            ');
          }

          agentContext = `
            Diretrizes específicas do lojista: ${agent.basePrompt || 'Nenhuma diretriz adicional.'}
            Contexto de Negócio (Onboarding):
            ${onboardingText}
          `;

          if (agent.examples && agent.examples.length > 0) {
            for (const example of agent.examples) {
              // Turnos históricos falsos injetados antes da conversa real (Few-Shot)
              messages.push({ role: 'user', content: example.userQuery });
              messages.push({ role: 'assistant', content: example.expectedResponse });
            }
          }
        }
      });
      
      // Busca fatos na base de conhecimento (RAG) baseando-se no final da conversa
      const lastLines = history.split('\n').filter(l => l.trim().length > 0);
      const queryContext = lastLines.slice(-2).join(' '); // usa as últimas interações como contexto de busca
      
      const relevantChunks = await this.knowledgeService.searchRelevantChunks(tenantId, agentId, queryContext, 3);
      
      if (relevantChunks.length > 0) {
        agentContext += `\n
        [BASE_DE_CONHECIMENTO_DA_EMPRESA]
        Fatos relevantes encontrados na base de conhecimento:
        ${relevantChunks.map(c => `- ${c}`).join('\n')}
        
        AVISO CRÍTICO (GUARDRAIL ANTI-ALUCINAÇÃO):
        Use ESTRITAMENTE as informações acima (Base de Conhecimento) para responder dúvidas técnicas, regras de negócio ou de preços. 
        NUNCA invente prazos, descontos, promoções, preços ou condições de frete que não estejam explicitamente listados nos fatos acima ou no histórico.
        Caso o cliente pergunte algo que não está na base, informe educadamente que você precisa verificar essa informação.
        [/BASE_DE_CONHECIMENTO_DA_EMPRESA]
        `;
      }
    }

    const systemPrompt = `
      Você é o assistente de vendas comercial do lojista no WhatsApp.
      Seu objetivo é gerar o rascunho de uma resposta focada em conversão e concisa.
      Use o histórico da conversa (que pode conter tags mascaradas como [CPF_MASKED_X]) para formular a melhor resposta e continuar o atendimento.
      NÃO RESOLVA variáveis inexistentes (ex: não crie nomes falsos como {nome} ou {cliente}).
      
      INSTRUÇÃO ESTRITA DE TOM DE VOZ: Você DEVE imitar fielmente as gírias, o ritmo, as saudações e o vocabulário demonstrados nos turnos de exemplo (se houver). Incorpore a personalidade do lojista na sua resposta.
      
      ${agentContext}
    `;

    messages.push({ role: 'user', content: `Histórico da conversa:\n\n${history}\n\nEscreva a próxima resposta do lojista:` });

    let googleModel = google('gemini-1.5-flash');
    let hasByok = false;

    if (tenantId) {
      const tenant = await this.prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { customGeminiApiKey: true }
      });
      if (tenant?.customGeminiApiKey) {
        const apiKey = CryptoHelper.decrypt(tenant.customGeminiApiKey);
        const customGoogle = createGoogleGenerativeAI({ apiKey });
        googleModel = customGoogle('gemini-1.5-flash');
        hasByok = true;
      }
    }

    try {
      this.logger.debug('Iniciando geração de rascunho de resposta (Copiloto) com gemini-1.5-flash');
      const { text } = await generateText({
        model: googleModel,
        system: systemPrompt,
        messages,
        temperature,
        ...(useTools && {
          tools: {
            verificarEstoque: tool({
              description: 'Verifica a disponibilidade de um produto no estoque',
              parameters: z.object({
                produtoNome: z.string().describe('Nome do produto para buscar no estoque'),
              }),
              execute: async ({ produtoNome }: any) => {
                // Mockando retorno
                return { emEstoque: true, quantidade: 12, produtoNome };
              },
            } as any),
            consultarFrete: tool({
              description: 'Consulta valor e prazo de frete baseado no CEP',
              parameters: z.object({
                cep: z.string().describe('CEP de destino'),
              }),
              execute: async ({ cep }: any) => {
                // Mockando retorno realista
                return { valor: 15.90, prazoDias: 3, cep };
              },
            } as any),
            criarLinkPagamento: tool({
              description: 'Gera um link de pagamento para finalizar a compra',
              parameters: z.object({
                valor: z.number().describe('Valor total a ser cobrado'),
                produtoNome: z.string().describe('Nome do produto ou serviço vendido'),
              }),
              execute: async ({ valor, produtoNome }: any) => {
                // Mockando retorno
                const id = Math.random().toString(36).substring(7);
                return { 
                  linkSeguro: `https://pagar.vendora.ai/pay_${id}`,
                  valor,
                  produtoNome
                };
              },
            } as any),
          },
          maxSteps: 3,
        }),
      });

      if (!hasByok && tenantId) {
        await this.prisma.tenant.update({
          where: { id: tenantId },
          data: { aiDraftsProcessedThisMonth: { increment: 1 } }
        });
      }

      return text.trim();
    } catch (error) {
      this.logger.error(`Falha ao gerar rascunho de resposta: ${error.message}`);
      throw new Error('Falha na geração de rascunho (Copiloto)');
    }
  }

  async generateConversationalSummary(conversationId: string, tenantId: string): Promise<string | null> {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId, tenantId },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
          take: 50,
        }
      }
    });

    if (!conversation || conversation.messages.length === 0) return null;

    const history = conversation.messages.map(msg => `[${msg.sender}]: ${msg.maskedContent}`).join('\n');

    const systemPrompt = `
      Você é um especialista em vendas que analisa histórico de conversas entre cliente e empresa.
      Sua tarefa é sintetizar o histórico de atendimento em no máximo 3 frases, detalhando:
      1. O produto/serviço de interesse do lead.
      2. As principais dores ou objeções relatadas (se houver).
      3. O status do desfecho comercial (venda ganha, perdida, ou abandonada por inatividade).
      Retorne apenas o texto do resumo narrativo.
    `;

    try {
      this.logger.debug('Gerando resumo conversacional com gemini-1.5-flash');
      const { text } = await generateText({
        model: google('gemini-1.5-flash'),
        system: systemPrompt,
        prompt: `Analise a seguinte conversa e gere o resumo narrativo:\n\n${history}`,
      });

      return text.trim();
    } catch (error) {
      this.logger.error(`Falha ao gerar resumo conversacional: ${error.message}`);
      return null;
    }
  }
}
