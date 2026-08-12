import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { Redis } from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: Redis;

  onModuleInit() {
    const redisUrl = process.env.REDIS_URL;
    if (redisUrl) {
      this.client = new Redis(redisUrl, { maxRetriesPerRequest: null });
    } else {
      this.client = new Redis({
        host: process.env.REDIS_HOST || '127.0.0.1',
        port: Number(process.env.REDIS_PORT) || 6379,
        password: process.env.REDIS_PASSWORD || undefined,
        db: 0,
        maxRetriesPerRequest: null,
      });
    }

    this.client.on('connect', () => {
      this.logger.log('Conectado ao Redis com sucesso.');
    });

    this.client.on('error', (err) => {
      this.logger.error('Erro na conexão com Redis:', err.message);
    });
  }

  onModuleDestroy() {
    if (this.client) {
      this.client.disconnect();
    }
  }

  getClient(): Redis {
    return this.client;
  }
}
