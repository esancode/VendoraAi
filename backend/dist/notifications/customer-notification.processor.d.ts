import { WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationGateway } from './notification.gateway';
export declare class CustomerNotificationProcessor extends WorkerHost {
    private readonly prisma;
    private readonly notificationGateway;
    private readonly logger;
    constructor(prisma: PrismaService, notificationGateway: NotificationGateway);
    process(job: Job<any, any, string>): Promise<void>;
}
