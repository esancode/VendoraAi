import { OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import 'dotenv/config';
export declare class SanitizerService implements OnModuleInit, OnModuleDestroy {
    private redisClient;
    private readonly cpfRegex;
    private readonly emailRegex;
    private readonly creditCardRegex;
    onModuleInit(): void;
    onModuleDestroy(): void;
    sanitize(content: string, tenantId: string, messageId: string): Promise<string>;
    private generateId;
    unmask(draft: string, tenantId: string, messageId: string): Promise<string>;
}
