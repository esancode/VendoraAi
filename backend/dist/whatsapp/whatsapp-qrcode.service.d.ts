import { PrismaService } from '../prisma/prisma.service';
import { EncryptionService } from '../security/encryption.service';
import { NotificationGateway } from '../notifications/notification.gateway';
import { Queue } from 'bullmq';
export declare class WhatsappQrCodeService {
    private readonly prisma;
    private readonly encryptionService;
    private readonly notificationGateway;
    private readonly ingestionQueue;
    private readonly logger;
    private activeSessions;
    private readonly loggerPino;
    constructor(prisma: PrismaService, encryptionService: EncryptionService, notificationGateway: NotificationGateway, ingestionQueue: Queue);
    comparePhoneNumbers(registered: string, scanned: string): boolean;
    initializeSession(tenantId: string, channelId: string): Promise<void>;
    disconnectSession(tenantId: string, channelId: string): Promise<void>;
    private useDatabaseAuthState;
}
