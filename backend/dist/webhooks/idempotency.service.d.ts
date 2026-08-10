import { OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import 'dotenv/config';
export declare class IdempotencyService implements OnModuleInit, OnModuleDestroy {
    private redisClient;
    onModuleInit(): void;
    onModuleDestroy(): void;
    checkMessageProcessed(wamid: string): Promise<boolean>;
}
