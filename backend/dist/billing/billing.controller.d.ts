import { PrismaService } from '../prisma/prisma.service';
import { BillingService } from './billing.service';
import type { FastifyRequest } from 'fastify';
export declare class BillingController {
    private readonly prisma;
    private readonly billingService;
    private readonly logger;
    constructor(prisma: PrismaService, billingService: BillingService);
    getStatus(req: FastifyRequest): Promise<{
        plan: import("@prisma/client").$Enums.SaasPlan;
        billingStatus: import("@prisma/client").$Enums.BillingStatus;
        trialEndsAt: Date | null;
        daysRemaining: number;
        messagesProcessedThisMonth: number;
        aiDraftsProcessedThisMonth: number;
        hasGeminiKey: boolean;
        hasOpenAiKey: boolean;
    }>;
    saveByok(req: FastifyRequest, body: {
        geminiKey?: string;
        openaiKey?: string;
    }): Promise<{
        success: boolean;
    }>;
    generateCheckoutLink(req: FastifyRequest, body: {
        plan: string;
    }): Promise<{
        paymentLinkUrl: any;
    }>;
    handleAsaasWebhook(asaasToken: string, payload: any): Promise<{
        success: boolean;
    }>;
}
