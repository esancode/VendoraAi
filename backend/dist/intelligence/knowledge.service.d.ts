import { PrismaService } from '../prisma/prisma.service';
export declare class KnowledgeService {
    private readonly prisma;
    private readonly logger;
    constructor(prisma: PrismaService);
    chunkText(text: string, maxLen?: number, overlap?: number): string[];
    createSource(tenantId: string, agentId: string, title: string, content: string): Promise<void>;
    searchRelevantChunks(tenantId: string, agentId: string, queryText: string, limit?: number): Promise<string[]>;
    deleteSource(tenantId: string, agentId: string, id: string): Promise<void>;
}
