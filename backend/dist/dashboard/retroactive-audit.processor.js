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
var RetroactiveAuditProcessor_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.RetroactiveAuditProcessor = void 0;
const bullmq_1 = require("@nestjs/bullmq");
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const ai_orchestrator_service_1 = require("../intelligence/ai-orchestrator.service");
const notification_gateway_1 = require("../notifications/notification.gateway");
let RetroactiveAuditProcessor = RetroactiveAuditProcessor_1 = class RetroactiveAuditProcessor extends bullmq_1.WorkerHost {
    prisma;
    aiOrchestrator;
    notificationGateway;
    logger = new common_1.Logger(RetroactiveAuditProcessor_1.name);
    constructor(prisma, aiOrchestrator, notificationGateway) {
        super();
        this.prisma = prisma;
        this.aiOrchestrator = aiOrchestrator;
        this.notificationGateway = notificationGateway;
    }
    async process(job) {
        this.logger.log(`Iniciando processamento de auditoria retroativa (Job ID: ${job.id})`);
        const { tenantId, channelId } = job.data;
        if (!tenantId || !channelId) {
            this.logger.error('Faltando tenantId ou channelId no job.');
            return;
        }
        const mockHistories = [
            {
                phone: '5511999991111',
                name: 'Carlos Oliveira',
                text: 'Cliente: Olá, gostaria de saber o valor da integração.\nVendedor: Oi Carlos! Custa R$ 5.000.\nCliente: Nossa, está muito fora do meu orçamento. Achei muito caro. Vou deixar para a próxima.',
                sla: 850,
            },
            {
                phone: '5511999992222',
                name: 'Fernanda Souza',
                text: 'Cliente: Preciso do sistema para ontem, quanto tempo para entregar?\nVendedor: Olá Fernanda, demoramos 30 dias úteis.\nCliente: Não dá, preciso de algo imediato. Vou procurar outro fornecedor.',
                sla: 2700,
            },
            {
                phone: '5511999993333',
                name: 'Roberto Costa',
                text: 'Cliente: Vi que a plataforma XYZ (concorrente) tem esse mesmo recurso por metade do preço e com Salesforce. Vocês integram com Salesforce?\nVendedor: Olá Roberto. Não integramos com Salesforce no momento.\nCliente: Então não serve para mim, vou fechar com a XYZ.',
                sla: 1360,
            },
            {
                phone: '5511999994444',
                name: 'Ana Pereira',
                text: 'Cliente: Vocês têm suporte 24/7?\nVendedor: Olá Ana, nosso suporte é apenas em horário comercial.\nCliente: Poxa, minha operação não para, preciso de 24/7. Que pena.',
                sla: 495,
            },
            {
                phone: '5511999995555',
                name: 'João Silva',
                text: 'Cliente: Vocês oferecem plano anual com desconto para PMEs?\nVendedor: Olá João, apenas preço de tabela mensal.\nCliente: Fica difícil assim. Obrigado.',
                sla: 1360,
            }
        ];
        try {
            let processedMessagesCount = 0;
            const agent = await this.prisma.agent.findFirst({ where: { tenantId } });
            for (const history of mockHistories) {
                const lead = await this.prisma.lead.upsert({
                    where: {
                        tenantId_phone: {
                            tenantId,
                            phone: history.phone
                        }
                    },
                    update: {},
                    create: {
                        tenantId,
                        name: history.name,
                        phone: history.phone,
                        status: 'LOST'
                    }
                });
                const conversation = await this.prisma.conversation.create({
                    data: {
                        tenantId,
                        leadId: lead.id,
                        status: 'OPEN',
                        agentId: agent?.id
                    }
                });
                this.logger.log(`Enviando conversa do lead ${history.name} para o Gemini...`);
                try {
                    const analysis = await this.aiOrchestrator.analyzeConversation(history.text);
                    let mappedReason = 'OTHER';
                    const reasonCat = analysis.classification.reasonCategory;
                    if (reasonCat === 'PRICE')
                        mappedReason = 'PRICE';
                    else if (reasonCat === 'COMPETITION')
                        mappedReason = 'COMPETITION';
                    else if (reasonCat === 'DELIVERY')
                        mappedReason = 'DELIVERY';
                    else if (reasonCat === 'PRODUCT')
                        mappedReason = 'PRODUCT';
                    else if (reasonCat === 'SERVICE')
                        mappedReason = 'SERVICE';
                    await this.prisma.conversation.update({
                        where: { id: conversation.id },
                        data: {
                            status: 'CLOSED',
                            lossReason: mappedReason,
                            lossReasonDetail: analysis.classification.semanticAnalysis || 'N/A',
                            confidenceScore: analysis.classification.confidenceScore || 0.9,
                            responseSlaSeconds: history.sla,
                            unmappedDemands: analysis.classification.unmappedDemands || [],
                            closedAt: new Date()
                        }
                    });
                    processedMessagesCount += 3;
                }
                catch (error) {
                    this.logger.error(`Erro ao analisar conversa com Gemini: ${error.message}`);
                }
            }
            await this.prisma.tenant.update({
                where: { id: tenantId },
                data: { onboardingCompleted: true }
            });
            this.logger.log(`Auditoria concluída com sucesso para o tenant ${tenantId}`);
            this.notificationGateway.broadcastToTenant(tenantId, 'dashboard.data_ready', {
                message: 'Auditoria retroativa finalizada',
                processedMessages: processedMessagesCount
            });
        }
        catch (error) {
            this.logger.error(`Erro crítico no processamento retroativo: ${error.message}`);
        }
    }
};
exports.RetroactiveAuditProcessor = RetroactiveAuditProcessor;
exports.RetroactiveAuditProcessor = RetroactiveAuditProcessor = RetroactiveAuditProcessor_1 = __decorate([
    (0, bullmq_1.Processor)('retroactive-audit'),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        ai_orchestrator_service_1.AiOrchestratorService,
        notification_gateway_1.NotificationGateway])
], RetroactiveAuditProcessor);
//# sourceMappingURL=retroactive-audit.processor.js.map