import { PrismaService } from '../prisma/prisma.service';
import { SlaService } from '../sla/sla.service';
import { Queue } from 'bullmq';
export declare class AgentReplyService {
    private readonly prisma;
    private readonly slaService;
    private readonly notificationQueue;
    private readonly logger;
    constructor(prisma: PrismaService, slaService: SlaService, notificationQueue: Queue);
    handleAgentReply(tenantId: string, leadId: string, content: string, agentId?: string): Promise<{
        id: string;
        tenantId: string;
        createdAt: Date;
        sender: import("@prisma/client").$Enums.MessageSender;
        rawContent: string | null;
        maskedContent: string;
        responseTime: number | null;
        conversationId: string;
    }>;
}
