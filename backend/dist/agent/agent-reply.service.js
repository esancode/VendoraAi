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
var AgentReplyService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AgentReplyService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const sla_service_1 = require("../sla/sla.service");
const bullmq_1 = require("@nestjs/bullmq");
const bullmq_2 = require("bullmq");
const client_1 = require("@prisma/client");
let AgentReplyService = AgentReplyService_1 = class AgentReplyService {
    prisma;
    slaService;
    notificationQueue;
    logger = new common_1.Logger(AgentReplyService_1.name);
    constructor(prisma, slaService, notificationQueue) {
        this.prisma = prisma;
        this.slaService = slaService;
        this.notificationQueue = notificationQueue;
    }
    async handleAgentReply(tenantId, leadId, content, agentId) {
        this.logger.log(`Handling agent reply for lead ${leadId}`);
        return await this.prisma.runInTenantContext(tenantId, async (tx) => {
            const lead = await tx.lead.findUnique({
                where: { id: leadId },
                include: {
                    conversations: {
                        where: { status: 'OPEN' },
                        include: {
                            messages: {
                                where: { sender: client_1.MessageSender.CUSTOMER },
                                orderBy: { createdAt: 'desc' },
                                take: 1,
                            },
                        },
                    },
                },
            });
            if (!lead) {
                throw new common_1.NotFoundException('Lead not found');
            }
            const conversation = lead.conversations[0];
            if (!conversation) {
                throw new common_1.NotFoundException('No open conversation found for this lead');
            }
            const lastCustomerMessage = conversation.messages[0];
            const now = new Date();
            let responseTimeInSeconds = null;
            if (lastCustomerMessage) {
                responseTimeInSeconds = this.slaService.calculateUsefulResponseTime(lastCustomerMessage.createdAt, now);
            }
            await tx.lead.update({
                where: { id: leadId },
                data: {
                    slaLimitAt: null,
                    lastInteractionAt: now,
                },
            });
            await tx.conversation.update({
                where: { id: conversation.id },
                data: {
                    responseSlaSeconds: {
                        increment: responseTimeInSeconds || 0,
                    },
                },
            });
            const agentMessage = await tx.message.create({
                data: {
                    tenantId,
                    conversationId: conversation.id,
                    sender: client_1.MessageSender.AGENT,
                    rawContent: content,
                    maskedContent: content,
                    createdAt: now,
                    responseTime: responseTimeInSeconds,
                },
            });
            try {
                const warnJobId = `sla-warn-${leadId}`;
                const breachJobId = `sla-breach-${leadId}`;
                await this.notificationQueue.remove(warnJobId);
                await this.notificationQueue.remove(breachJobId);
                this.logger.log(`Cancelled SLA delay jobs for lead ${leadId}`);
            }
            catch (error) {
                this.logger.warn(`Failed to remove SLA jobs for lead ${leadId}: ${error.message}`);
            }
            return agentMessage;
        });
    }
};
exports.AgentReplyService = AgentReplyService;
exports.AgentReplyService = AgentReplyService = AgentReplyService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(2, (0, bullmq_1.InjectQueue)('customer-notification')),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        sla_service_1.SlaService,
        bullmq_2.Queue])
], AgentReplyService);
//# sourceMappingURL=agent-reply.service.js.map