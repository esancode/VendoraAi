import { PrismaService } from '../prisma/prisma.service';
import { AiOrchestratorService } from '../intelligence/ai-orchestrator.service';
export declare class ChatsService {
    private readonly prisma;
    private readonly aiOrchestrator;
    private readonly logger;
    constructor(prisma: PrismaService, aiOrchestrator: AiOrchestratorService);
    getActiveChats(tenantId: string): Promise<{
        id: string;
        name: string;
        phone: string;
        status: import("@prisma/client").$Enums.LeadStatus;
        lastMessage: string | null;
        lastMessageAt: Date;
        conversationId: string;
        unreadCount: number;
    }[]>;
    getMessages(tenantId: string, leadId: string): Promise<{
        id: string;
        text: string;
        sender: string;
        timestamp: string;
    }[]>;
    generateDraft(tenantId: string, leadId: string): Promise<{
        draft: string;
    }>;
}
