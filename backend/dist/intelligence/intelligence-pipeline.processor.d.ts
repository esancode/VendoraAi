import { WorkerHost } from '@nestjs/bullmq';
import { Job, Queue } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { AiOrchestratorService } from './ai-orchestrator.service';
import { GuardrailService } from '../security/guardrail.service';
import { SanitizerService } from '../security/sanitizer.service';
import { NotificationGateway } from '../notifications/notification.gateway';
export interface IntelligenceJobPayload {
    tenantId: string;
    leadId: string;
    messageId: string;
    agentId: string;
}
export declare class IntelligencePipelineProcessor extends WorkerHost {
    private readonly prisma;
    private readonly aiOrchestrator;
    private readonly guardrailService;
    private readonly sanitizerService;
    private readonly notificationGateway;
    private whatsappQueue;
    private readonly logger;
    constructor(prisma: PrismaService, aiOrchestrator: AiOrchestratorService, guardrailService: GuardrailService, sanitizerService: SanitizerService, notificationGateway: NotificationGateway, whatsappQueue: Queue);
    process(job: Job<IntelligenceJobPayload, any, string>): Promise<void>;
}
