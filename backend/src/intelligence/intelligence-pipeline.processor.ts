import { Processor, WorkerHost, InjectQueue } from '@nestjs/bullmq';
import { Job, Queue } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { AiOrchestratorService } from './ai-orchestrator.service';
import { ConversationStatus, LeadStatus, LossReason } from '@prisma/client';
import { Logger } from '@nestjs/common';
import { GuardrailService } from '../security/guardrail.service';
import { SanitizerService } from '../security/sanitizer.service';
import { NotificationGateway } from '../notifications/notification.gateway';
import { calculateTypingDelay } from '../common/utils/delay.util';

export interface IntelligenceJobPayload {
  tenantId: string;
  leadId: string;
  messageId: string;
  agentId: string;
}

@Processor('intelligence-pipeline')
export class IntelligencePipelineProcessor extends WorkerHost {
  private readonly logger = new Logger(IntelligencePipelineProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly aiOrchestrator: AiOrchestratorService,
    private readonly guardrailService: GuardrailService,
    private readonly sanitizerService: SanitizerService,
    private readonly notificationGateway: NotificationGateway,
    @InjectQueue('whatsapp-outbound') private whatsappQueue: Queue,
  ) {
    super();
  }

  async process(job: Job<IntelligenceJobPayload, any, string>): Promise<void> {
    const { tenantId, leadId, messageId, agentId } = job.data;
    this.logger.log(`Iniciando análise inteligente. Tenant: ${tenantId}, Lead: ${leadId}, Agent: ${agentId}`);

    await this.prisma.runInTenantContext(tenantId, async (tx) => {
      // Busca a conversa atual do Lead e seu histórico de mensagens sanitizadas
      const conversation = await tx.conversation.findFirst({
        where: {
          tenantId,
          leadId,
          status: ConversationStatus.OPEN,
        },
        include: {
          messages: {
            orderBy: { createdAt: 'asc' },
            take: 50, // Analisa as últimas 50 mensagens
          },
        },
      });

      if (!conversation || conversation.messages.length === 0) {
        this.logger.warn(`Nenhuma conversa aberta ou mensagens encontradas para Lead ${leadId}`);
        return;
      }

      // Constrói o histórico
      const history = conversation.messages.map((msg) => {
        return `[${msg.sender}]: ${msg.maskedContent}`;
      }).join('\n');

      // Executa a IA para classificação
      const { classification, usage } = await this.aiOrchestrator.analyzeConversation(history, tenantId);

      this.logger.debug(`Classificação: ${JSON.stringify(classification)}`);

      // Regras de negócio baseadas na classificação
      if (classification.status === 'LOST' || classification.status === 'WON') {
        const isLost = classification.status === 'LOST';
        const isHighConfidence = classification.confidenceScore >= 0.85;

        const newLeadStatus = isLost ? LeadStatus.LOST : LeadStatus.WON;
        
        // Define os motivos de perda
        let finalLossReason: LossReason | null = null;
        let finalLossDetail: string | null = null;
        let needsHumanReview = false;

        if (isLost) {
          if (isHighConfidence) {
            finalLossReason = classification.reasonCategory as LossReason;
            finalLossDetail = classification.semanticAnalysis;
          } else {
            // Gatilho de Revisão Humana
            finalLossReason = LossReason.OTHER;
            finalLossDetail = classification.semanticAnalysis;
            needsHumanReview = true;
          }
        }

        // Atualiza Conversa
        await tx.conversation.update({
          where: { id: conversation.id },
          data: {
            status: ConversationStatus.CLOSED,
            closedAt: new Date(),
            lossReason: finalLossReason,
            lossReasonDetail: finalLossDetail,
            confidenceScore: classification.confidenceScore,
          },
        });

        // Atualiza Lead
        await tx.lead.update({
          where: { id: leadId },
          data: {
            status: newLeadStatus,
            needsHumanReview,
          },
        });

        this.logger.log(`Conversa ${conversation.id} encerrada como ${classification.status} (Review: ${needsHumanReview})`);
      } else {
        // Verifica status do Agente
        const agent = await tx.agent.findUnique({ where: { id: agentId } });
        const isAutonomous = agent?.status === true;

        if (isAutonomous) {
          this.logger.log(`Agente ATIVO. Gerando resposta autônoma com Tools.`);
        } else {
          this.logger.log(`Agente INATIVO. Gerando rascunho de resposta (Copiloto)`);
        }

        let draft = await this.aiOrchestrator.generateReplyDraft(history, tenantId, isAutonomous, agentId);
        
        // Output Guardrails
        const isValid = this.guardrailService.validateDraft(draft);
        if (!isValid) {
          this.logger.warn(`Rascunho reprovado pelos Guardrails. Usando fallback padrão.`);
          draft = 'Olá! Como posso te ajudar hoje?';
        } else {
          // Reconstituição de PII (Local Unmask)
          draft = await this.sanitizerService.unmask(draft, tenantId, messageId);
        }

        if (isAutonomous) {
          const isHighConfidence = classification.confidenceScore >= 0.85 && isValid;
          
          if (isHighConfidence) {
            const delay = calculateTypingDelay(draft);
            this.logger.log(`Alta confiança (${classification.confidenceScore}). Agendando disparo autônomo com delay de ${delay}ms`);
            
            await this.whatsappQueue.add('send-message', {
              tenantId,
              leadId,
              conversationId: conversation.id,
              content: draft,
            }, { delay });
          } else {
            this.logger.warn(`Baixa confiança ou falha no Guardrail (score=${classification.confidenceScore}, valid=${isValid}). Acionando HITL.`);
            
            // Pausa o robô alterando status para MANUAL_INTERVENTION_REQUIRED
            await tx.lead.update({
              where: { id: leadId },
              data: {
                status: LeadStatus.MANUAL_INTERVENTION_REQUIRED,
                needsHumanReview: true,
              },
            });

            // Emite evento para revisão humana urgente
            this.notificationGateway.broadcastToTenant(tenantId, 'lead.manual_intervention_required', {
              leadId,
              conversationId: conversation.id,
              draft,
            });
          }
        } else {
          // Emitir notificação WebSocket padrão do Copiloto
          this.notificationGateway.broadcastToTenant(tenantId, 'lead.draft_suggested', {
            leadId,
            conversationId: conversation.id,
            draft,
          });
        }
      }

      // Grava Bilhetagem (FinOps)
      const date = new Date();
      const billingPeriodYm = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      
      await tx.usageLog.create({
        data: {
          tenantId,
          tokenCount: usage.totalTokens, // Obs: Tokens do rascunho não incluídos aqui por simplicidade
          messageCount: 0, 
          billingPeriodYm,
        },
      });
      
      this.logger.log(`Tokens registrados: ${usage.totalTokens}`);
    });
  }
}
