import { WorkerHost } from '@nestjs/bullmq';
import { Queue, Job } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { EncryptionService } from '../security/encryption.service';
import { SanitizerService } from '../security/sanitizer.service';
import { SlaService } from '../sla/sla.service';
export declare class WhatsappIngestionProcessor extends WorkerHost {
    private readonly prisma;
    private readonly encryptionService;
    private readonly sanitizerService;
    private readonly slaService;
    private readonly intelligenceQueue;
    private readonly notificationQueue;
    constructor(prisma: PrismaService, encryptionService: EncryptionService, sanitizerService: SanitizerService, slaService: SlaService, intelligenceQueue: Queue, notificationQueue: Queue);
    process(job: Job<any, any, string>): Promise<void>;
}
