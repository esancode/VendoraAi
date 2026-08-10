import { PrismaService } from '../prisma/prisma.service';
import { KnowledgeService } from '../intelligence/knowledge.service';
export declare class OnboardingService {
    private readonly prisma;
    private readonly knowledgeService;
    private readonly logger;
    constructor(prisma: PrismaService, knowledgeService: KnowledgeService);
    processOnboardingData(tenantId: string, userId: string, data: any): Promise<{
        success: boolean;
        message: string;
    }>;
}
