import { PrismaService } from '../prisma/prisma.service';
import { SaasPlan } from '@prisma/client';
export declare class BillingService {
    private readonly prisma;
    private readonly logger;
    private readonly asaasApiUrl;
    private readonly asaasApiKey;
    constructor(prisma: PrismaService);
    createCheckoutLink(tenantId: string, plan: SaasPlan): Promise<{
        paymentLinkUrl: any;
    }>;
}
