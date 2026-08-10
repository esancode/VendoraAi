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
var SessaoInatividadeService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.SessaoInatividadeService = void 0;
const common_1 = require("@nestjs/common");
const schedule_1 = require("@nestjs/schedule");
const prisma_service_1 = require("../prisma/prisma.service");
const ai_orchestrator_service_1 = require("./ai-orchestrator.service");
const client_1 = require("@prisma/client");
let SessaoInatividadeService = SessaoInatividadeService_1 = class SessaoInatividadeService {
    prisma;
    aiOrchestrator;
    logger = new common_1.Logger(SessaoInatividadeService_1.name);
    constructor(prisma, aiOrchestrator) {
        this.prisma = prisma;
        this.aiOrchestrator = aiOrchestrator;
    }
    async checkInactiveConversations() {
        this.logger.log('Iniciando verificação de conversas inativas (mais de 12 horas)...');
        const twelveHoursAgo = new Date(Date.now() - 12 * 60 * 60 * 1000);
        const inactiveLeads = await this.prisma.lead.findMany({
            where: {
                lastInteractionAt: { lt: twelveHoursAgo },
                conversations: {
                    some: { status: client_1.ConversationStatus.OPEN }
                }
            },
            include: {
                conversations: {
                    where: { status: client_1.ConversationStatus.OPEN }
                }
            }
        });
        if (inactiveLeads.length > 0) {
            this.logger.log(`Encontrados ${inactiveLeads.length} leads com conversas inativas.`);
        }
        for (const lead of inactiveLeads) {
            for (const conversation of lead.conversations) {
                try {
                    this.logger.debug(`Gerando resumo para conversa inativa: ${conversation.id}`);
                    const summary = await this.aiOrchestrator.generateConversationalSummary(conversation.id, lead.tenantId);
                    await this.prisma.$transaction(async (tx) => {
                        await tx.conversation.update({
                            where: { id: conversation.id },
                            data: {
                                status: client_1.ConversationStatus.CLOSED,
                                closedAt: new Date()
                            }
                        });
                        if (summary) {
                            await tx.lead.update({
                                where: { id: lead.id },
                                data: { conversationalSummary: summary }
                            });
                        }
                    });
                    this.logger.log(`Conversa ${conversation.id} encerrada por inatividade e resumida no lead ${lead.id}.`);
                }
                catch (error) {
                    this.logger.error(`Erro ao processar inatividade da conversa ${conversation.id}`, error);
                }
            }
        }
    }
};
exports.SessaoInatividadeService = SessaoInatividadeService;
__decorate([
    (0, schedule_1.Cron)(schedule_1.CronExpression.EVERY_HOUR),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], SessaoInatividadeService.prototype, "checkInactiveConversations", null);
exports.SessaoInatividadeService = SessaoInatividadeService = SessaoInatividadeService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        ai_orchestrator_service_1.AiOrchestratorService])
], SessaoInatividadeService);
//# sourceMappingURL=sessao-inatividade.service.js.map