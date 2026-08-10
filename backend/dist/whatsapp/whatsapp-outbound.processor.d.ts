import { WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
export interface WhatsappOutboundPayload {
    tenantId: string;
    leadId: string;
    conversationId: string;
    content: string;
}
export declare class WhatsappOutboundProcessor extends WorkerHost {
    private readonly prisma;
    private readonly logger;
    constructor(prisma: PrismaService);
    process(job: Job<WhatsappOutboundPayload, any, string>): Promise<void>;
}
