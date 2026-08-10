import { PrismaService } from '../prisma/prisma.service';
import { LossClassification } from './schemas/loss-classification.schema';
import { KnowledgeService } from './knowledge.service';
export declare class AiOrchestratorService {
    private readonly prisma;
    private readonly knowledgeService;
    private readonly logger;
    constructor(prisma: PrismaService, knowledgeService: KnowledgeService);
    analyzeConversation(conversationHistory: string, tenantId?: string): Promise<{
        classification: LossClassification;
        usage: any;
    }>;
    generateReplyDraft(history: string, tenantId?: string, useTools?: boolean, agentId?: string): Promise<string>;
    generateConversationalSummary(conversationId: string, tenantId: string): Promise<string | null>;
}
