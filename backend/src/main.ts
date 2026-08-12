import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from './app.module';
import fastifyCookie from '@fastify/cookie';
import rawBody from 'fastify-raw-body';
import { RedisIoAdapter } from './notifications/redis-io.adapter';

async function bootstrap() {
  process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  });
  process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
  });

  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter(),
    { cors: { origin: true, credentials: true } }
  );

  await app.register(fastifyCookie as any, {
    secret: process.env.COOKIE_SECRET || 'vendora-cookie-secret',
  });

  await app.register(rawBody as any, {
    field: 'rawBody', // req.rawBody
    global: true,
    encoding: 'utf8',
    runFirst: true, // ensure it runs before body parsers
  });

  const redisIoAdapter = new RedisIoAdapter(app);
  await redisIoAdapter.connectToRedis();
  app.useWebSocketAdapter(redisIoAdapter);

  const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
  await app.listen(port, '0.0.0.0');
  console.log(`Nest successfully listening on 0.0.0.0:${port}`);
}
bootstrap();
// Trigger rebuild for AgentController