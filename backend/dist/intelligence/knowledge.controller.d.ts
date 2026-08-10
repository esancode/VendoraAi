import { KnowledgeService } from './knowledge.service';
import { PrismaService } from '../prisma/prisma.service';
import type { FastifyRequest } from 'fastify';
export declare class KnowledgeController {
    private readonly knowledgeService;
    private readonly prisma;
    constructor(knowledgeService: KnowledgeService, prisma: PrismaService);
    getKnowledgeSources(req: FastifyRequest, agentId: string): Promise<{
        status: string;
        chunkCount: number;
        id: string;
        updatedAt: Date;
        title: string;
        content: string;
    }[]>;
    createKnowledgeSource(req: FastifyRequest, body: {
        title: string;
        content: string;
        agentId: string;
    }): Promise<{
        success: boolean;
    }>;
    deleteKnowledgeSource(req: FastifyRequest, id: string, agentId: string): Promise<{
        success: boolean;
    }>;
}
