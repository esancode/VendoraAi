import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from './app.module';
import fastifyCookie from '@fastify/cookie';
import rawBody from 'fastify-raw-body';
import { RedisIoAdapter } from './notifications/redis-io.adapter';

import { Catch, ArgumentsHost, Logger, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';

@Catch()
class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionsHandler');

  catch(exception: unknown, host: ArgumentsHost) {
    this.logger.error('Unhandled exception caught:', exception);
    
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    
    const status = exception instanceof HttpException 
      ? exception.getStatus() 
      : HttpStatus.INTERNAL_SERVER_ERROR;
      
    response.status(status).send({
      statusCode: status,
      message: exception instanceof Error ? exception.message : 'Internal server error',
    });
  }
}

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

  app.useGlobalFilters(new AllExceptionsFilter());

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