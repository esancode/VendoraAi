import { PrismaService } from '../prisma/prisma.service';
import type { FastifyRequest } from 'fastify';
export declare class LeadsController {
    private readonly prisma;
    constructor(prisma: PrismaService);
    getPriorityLeads(req: FastifyRequest, agentId?: string): Promise<{
        id: string;
        name: string;
        status: import("@prisma/client").$Enums.LeadStatus;
        createdAt: Date;
        slaLimitAt: Date | null;
        lastMessage: string;
    }[]>;
}
