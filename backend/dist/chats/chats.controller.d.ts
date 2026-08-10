import { ChatsService } from './chats.service';
import type { FastifyRequest } from 'fastify';
export declare class ChatsController {
    private readonly chatsService;
    private readonly logger;
    constructor(chatsService: ChatsService);
    getActiveChats(req: FastifyRequest): Promise<{
        id: string;
        name: string;
        phone: string;
        status: import("@prisma/client").$Enums.LeadStatus;
        lastMessage: string | null;
        lastMessageAt: Date;
        conversationId: string;
        unreadCount: number;
    }[]>;
    getMessages(req: FastifyRequest, leadId: string): Promise<{
        id: string;
        text: string;
        sender: string;
        timestamp: string;
    }[]>;
    generateDraft(req: FastifyRequest, leadId: string): Promise<{
        draft: string;
    }>;
}
