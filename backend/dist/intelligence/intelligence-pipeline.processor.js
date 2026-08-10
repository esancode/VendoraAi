"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var IntelligencePipelineProcessor_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.IntelligencePipelineProcessor = void 0;
const bullmq_1 = require("@nestjs/bullmq");
const bullmq_2 = require("bullmq");
const prisma_service_1 = require("../prisma/prisma.service");
const ai_orchestrator_service_1 = require("./ai-orchestrator.service");
const client_1 = require("@prisma/client");
const common_1 = require("@nestjs/common");
const guardrail_service_1 = require("../security/guardrail.service");
const sanitizer_service_1 = require("../security/sanitizer.service");
const notification_gateway_1 = require("../notifications/notification.gateway");
const delay_util_1 = require("../common/utils/delay.util");
let IntelligencePipelineProcessor = IntelligencePipelineProcessor_1 = class IntelligencePipelineProcessor extends bullmq_1.WorkerHost {
    prisma;
    aiOrchestrator;
    guardrailService;
    sanitizerService;
    notificationGateway;
    whatsappQueue;
    logger = new common_1.Logger(IntelligencePipelineProcessor_1.name);
    constructor(prisma, aiOrchestrator, guardrailService, sanitizerService, notificationGateway, whatsappQueue) {
        super();
        this.prisma = prisma;
        this.aiOrchestrator = aiOrchestrator;
        this.guardrailService = guardrailService;
        this.sanitizerService = sanitizerService;
        this.notificationGateway = notificationGateway;
        this.whatsappQueue = whatsappQueue;
    }
    async process(job) {
        const { tenantId, leadId, messageId, agentId } = job.data;
        this.logger.log(`Iniciando análise inteligente. Tenant: ${tenantId}, Lead: ${leadId}, Agent: ${agentId}`);
        await this.prisma.runInTenantContext(tenantId, async (tx) => {
            const conversation = await tx.conversation.findFirst({
                where: {
                    tenantId,
                    leadId,
                    status: client_1.ConversationStatus.OPEN,
                },
                include: {
                    messages: {
                        orderBy: { createdAt: 'asc' },
                        take: 50,
                    },
                },
            });
            if (!conversation || conversation.messages.length === 0) {
                this.logger.warn(`Nenhuma conversa aberta ou mensagens encontradas para Lead ${leadId}`);
                return;
            }
            const history = conversation.messages.map((msg) => {
                return `[${msg.sender}]: ${msg.maskedContent}`;
            }).join('\n');
            const { classification, usage } = await this.aiOrchestrator.analyzeConversation(history, tenantId);
            this.logger.debug(`Classificação: ${JSON.stringify(classification)}`);
            if (classification.status === 'LOST' || classification.status === 'WON') {
                const isLost = classification.status === 'LOST';
                const isHighConfidence = classification.confidenceScore >= 0.85;
                const newLeadStatus = isLost ? client_1.LeadStatus.LOST : client_1.LeadStatus.WON;
                let finalLossReason = null;
                let finalLossDetail = null;
                let needsHumanReview = false;
                if (isLost) {
                    if (isHighConfidence) {
                        finalLossReason = classification.reasonCategory;
                        finalLossDetail = classification.semanticAnalysis;
                    }
                    else {
                        finalLossReason = client_1.LossReason.OTHER;
                        finalLossDetail = classification.semanticAnalysis;
                        needsHumanReview = true;
                    }
                }
                await tx.conversation.update({
                    where: { id: conversation.id },
                    data: {
                        status: client_1.ConversationStatus.CLOSED,
                        closedAt: new Date(),
                        lossReason: finalLossReason,
                        lossReasonDetail: finalLossDetail,
                        confidenceScore: classification.confidenceScore,
                    },
                });
                await tx.lead.update({
                    where: { id: leadId },
                    data: {
                        status: newLeadStatus,
                        needsHumanReview,
                    },
                });
                this.logger.log(`Conversa ${conversation.id} encerrada como ${classification.status} (Review: ${needsHumanReview})`);
            }
            else {
                const agent = await tx.agent.findUnique({ where: { id: agentId } });
                const isAutonomous = agent?.status === true;
                if (isAutonomous) {
                    this.logger.log(`Agente ATIVO. Gerando resposta autônoma com Tools.`);
                }
                else {
                    this.logger.log(`Agente INATIVO. Gerando rascunho de resposta (Copiloto)`);
                }
                let draft = await this.aiOrchestrator.generateReplyDraft(history, tenantId, isAutonomous, agentId);
                const isValid = this.guardrailService.validateDraft(draft);
                if (!isValid) {
                    this.logger.warn(`Rascunho reprovado pelos Guardrails. Usando fallback padrão.`);
                    draft = 'Olá! Como posso te ajudar hoje?';
                }
                else {
                    draft = await this.sanitizerService.unmask(draft, tenantId, messageId);
                }
                if (isAutonomous) {
                    const isHighConfidence = classification.confidenceScore >= 0.85 && isValid;
                    if (isHighConfidence) {
                        const delay = (0, delay_util_1.calculateTypingDelay)(draft);
                        this.logger.log(`Alta confiança (${classification.confidenceScore}). Agendando disparo autônomo com delay de ${delay}ms`);
                        await this.whatsappQueue.add('send-message', {
                            tenantId,
                            leadId,
                            conversationId: conversation.id,
                            content: draft,
                        }, { delay });
                    }
                    else {
                        this.logger.warn(`Baixa confiança ou falha no Guardrail (score=${classification.confidenceScore}, valid=${isValid}). Acionando HITL.`);
                        await tx.lead.update({
                            where: { id: leadId },
                            data: {
                                status: client_1.LeadStatus.MANUAL_INTERVENTION_REQUIRED,
                                needsHumanReview: true,
                            },
                        });
                        this.notificationGateway.broadcastToTenant(tenantId, 'lead.manual_intervention_required', {
                            leadId,
                            conversationId: conversation.id,
                            draft,
                        });
                    }
                }
                else {
                    this.notificationGateway.broadcastToTenant(tenantId, 'lead.draft_suggested', {
                        leadId,
                        conversationId: conversation.id,
                        draft,
                    });
                }
            }
            const date = new Date();
            const billingPeriodYm = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            await tx.usageLog.create({
                data: {
                    tenantId,
                    tokenCount: usage.totalTokens,
                    messageCount: 0,
                    billingPeriodYm,
                },
            });
            this.logger.log(`Tokens registrados: ${usage.totalTokens}`);
        });
    }
};
exports.IntelligencePipelineProcessor = IntelligencePipelineProcessor;
exports.IntelligencePipelineProcessor = IntelligencePipelineProcessor = IntelligencePipelineProcessor_1 = __decorate([
    (0, bullmq_1.Processor)('intelligence-pipeline'),
    __param(5, (0, bullmq_1.InjectQueue)('whatsapp-outbound')),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        ai_orchestrator_service_1.AiOrchestratorService,
        guardrail_service_1.GuardrailService,
        sanitizer_service_1.SanitizerService,
        notification_gateway_1.NotificationGateway,
        bullmq_2.Queue])
], IntelligencePipelineProcessor);
//# sourceMappingURL=intelligence-pipeline.processor.js.map