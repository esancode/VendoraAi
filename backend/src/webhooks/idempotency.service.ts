import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import Redis from 'ioredis';
import 'dotenv/config';

@Injectable()
export class IdempotencyService implements OnModuleInit, OnModuleDestroy {
  private redisClient: Redis;

  onModuleInit() {
    const redisUrl = process.env.REDIS_URL;
    if (redisUrl) {
      this.redisClient = new Redis(redisUrl, { db: 2 });
    } else {
      this.redisClient = new Redis({
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379', 10),
        db: 2, // Using DB 2 for idempotency as requested
      });
    }
  }

  onModuleDestroy() {
    this.redisClient.disconnect();
  }

  /**
   * Verifica a idempotência de uma mensagem.
   * Retorna true se a mensagem já foi processada, false caso contrário.
   */
  async checkMessageProcessed(wamid: string): Promise<boolean> {
    if (!wamid) return false;
    
    const key = `whatsapp:msg:${wamid}`;
    // Tenta setar a chave com expiração de 24 horas (86400 segundos)
    const result = await this.redisClient.set(key, '1', 'EX', 86400, 'NX');
    
    // Se result for 'OK', a chave não existia e foi criada (não processada)
    // Se result for null, a chave já existia (já processada)
    return result !== 'OK';
  }
}
