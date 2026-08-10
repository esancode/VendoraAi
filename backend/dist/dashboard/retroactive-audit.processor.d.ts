import { WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { AiOrchestratorService } from '../intelligence/ai-orchestrator.service';
import { NotificationGateway } from '../notifications/notification.gateway';
export declare class RetroactiveAuditProcessor extends WorkerHost {
    private readonly prisma;
    private readonly aiOrchestrator;
    private readonly notificationGateway;
    private readonly logger;
    constructor(prisma: PrismaService, aiOrchestrator: AiOrchestratorService, notificationGateway: NotificationGateway);
    process(job: Job<any, any, string>): Promise<any>;
}
