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
var ChatsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChatsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const ai_orchestrator_service_1 = require("../intelligence/ai-orchestrator.service");
let ChatsService = ChatsService_1 = class ChatsService {
    prisma;
    aiOrchestrator;
    logger = new common_1.Logger(ChatsService_1.name);
    constructor(prisma, aiOrchestrator) {
        this.prisma = prisma;
        this.aiOrchestrator = aiOrchestrator;
    }
    async getActiveChats(tenantId) {
        const leads = await this.prisma.lead.findMany({
            where: {
                tenantId,
                status: { in: ['ACTIVE', 'MANUAL_INTERVENTION_REQUIRED'] }
            },
            include: {
                conversations: {
                    where: { status: 'OPEN' },
                    orderBy: { createdAt: 'desc' },
                    take: 1,
                    include: {
                        messages: {
                            orderBy: { createdAt: 'desc' },
                            take: 1,
                        }
                    }
                }
            },
            orderBy: { lastInteractionAt: 'desc' },
            take: 50,
        });
        return leads.map(lead => {
            const activeConversation = lead.conversations[0];
            const lastMessage = activeConversation?.messages[0];
            return {
                id: lead.id,
                name: lead.name,
                phone: lead.phone,
                status: lead.status,
                lastMessage: lastMessage ? lastMessage.rawContent || lastMessage.maskedContent : null,
                lastMessageAt: lastMessage?.createdAt || lead.lastInteractionAt,
                conversationId: activeConversation?.id,
                unreadCount: 0
            };
        });
    }
    async getMessages(tenantId, leadId) {
        const lead = await this.prisma.lead.findUnique({
            where: { id: leadId, tenantId },
            include: {
                conversations: {
                    where: { status: 'OPEN' },
                    orderBy: { createdAt: 'desc' },
                    take: 1,
                }
            }
        });
        if (!lead || !lead.conversations.length) {
            return [];
        }
        const conversationId = lead.conversations[0].id;
        const messages = await this.prisma.message.findMany({
            where: { conversationId, tenantId },
            orderBy: { createdAt: 'asc' },
        });
        return messages.map(m => ({
            id: m.id,
            text: m.rawContent || m.maskedContent,
            sender: m.sender === 'CUSTOMER' ? 'customer' : 'agent',
            timestamp: m.createdAt.toISOString()
        }));
    }
    async generateDraft(tenantId, leadId) {
        const lead = await this.prisma.lead.findUnique({
            where: { id: leadId, tenantId },
            include: {
                conversations: {
                    where: { status: 'OPEN' },
                    orderBy: { createdAt: 'desc' },
                    take: 1,
                }
            }
        });
        if (!lead || !lead.conversations.length) {
            throw new common_1.NotFoundException('Nenhuma conversa ativa encontrada para este lead.');
        }
        const conversation = lead.conversations[0];
        const messages = await this.prisma.message.findMany({
            where: { conversationId: conversation.id, tenantId },
            orderBy: { createdAt: 'asc' },
            take: 20,
        });
        let historyStr = '';
        for (const msg of messages) {
            const prefix = msg.sender === 'CUSTOMER' ? '[CUSTOMER]: ' : '[AGENT]: ';
            const content = msg.rawContent || msg.maskedContent || '';
            historyStr += `${prefix}${content}\n`;
        }
        const draft = await this.aiOrchestrator.generateReplyDraft(historyStr, tenantId, false, conversation.agentId || undefined);
        return { draft };
    }
};
exports.ChatsService = ChatsService;
exports.ChatsService = ChatsService = ChatsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        ai_orchestrator_service_1.AiOrchestratorService])
], ChatsService);
//# sourceMappingURL=chats.service.js.map