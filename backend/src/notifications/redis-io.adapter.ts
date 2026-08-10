import { IoAdapter } from '@nestjs/platform-socket.io';
import { ServerOptions } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { Redis } from 'ioredis';

export class RedisIoAdapter extends IoAdapter {
  private adapterConstructor: ReturnType<typeof createAdapter>;

  async connectToRedis(redisUrl?: string): Promise<void> {
    const pubClient = new Redis(redisUrl || process.env.REDIS_URL || 'redis://localhost:6379');
    const subClient = pubClient.duplicate();

    pubClient.on('error', (err) => console.error('Redis PubClient Error:', err.message));
    subClient.on('error', (err) => console.error('Redis SubClient Error:', err.message));

    this.adapterConstructor = createAdapter(pubClient, subClient);
  }

  createIOServer(port: number, options?: ServerOptions): any {
    const server = super.createIOServer(port, {
      ...options,
      cors: {
        origin: true,
        credentials: true,
      },
    });
    server.adapter(this.adapterConstructor);
    return server;
  }
}
