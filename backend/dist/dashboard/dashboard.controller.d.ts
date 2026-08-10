import { PrismaService } from '../prisma/prisma.service';
import type { FastifyRequest } from 'fastify';
import { Queue } from 'bullmq';
export declare class DashboardController {
    private readonly prisma;
    private readonly auditQueue;
    constructor(prisma: PrismaService, auditQueue: Queue);
    getStatus(req: FastifyRequest): Promise<{
        isChannelConnected: boolean;
        isDataAnalyzed: boolean;
        tenantStatus: {
            status: string;
            processedMessages: number;
            onboardingCompleted: boolean | undefined;
        };
    }>;
    triggerAudit(req: FastifyRequest): Promise<{
        success: boolean;
        message: string;
    }>;
    getNarrativeInsights(req: FastifyRequest): Promise<{
        managerName: string;
        avgSlaMinutes: number;
        coolingLeads: number;
        topLossReason: string | null;
        topLossPercentage: number;
        estimatedLossBrl: number;
    }>;
    getObjections(req: FastifyRequest): Promise<{
        category: import("@prisma/client").$Enums.LossReason;
        percentage: number;
        estimatedLoss: number;
    }[]>;
    getSlaBottlenecks(req: FastifyRequest): Promise<{
        agentId: string;
        agentName: string;
        avatarUrl: string;
        avgSlaFormatted: string;
        coolingLeadsCount: number;
        delayLossCount: number;
    }[]>;
    getUnmappedDemands(req: FastifyRequest): Promise<{
        term: string;
        count: number;
    }[]>;
    getStats(req: FastifyRequest): Promise<{
        openLeadsCount: number;
        avgSlaMinutes: number;
        breachingSlaCount: number;
        topLossReason: string | null;
    }>;
}
