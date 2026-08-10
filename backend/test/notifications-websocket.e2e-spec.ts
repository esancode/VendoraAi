import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { io, Socket } from 'socket.io-client';
import { AppModule } from '../src/app.module';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { RedisIoAdapter } from '../src/notifications/redis-io.adapter';
import { JwtService } from '@nestjs/jwt';
import { NotificationGateway } from '../src/notifications/notification.gateway';

describe('Notifications WebSocket (e2e)', () => {
  let app: NestFastifyApplication;
  let socket: Socket;
  let jwtService: JwtService;
  let gateway: NotificationGateway;
  
  const tenantId = '123e4567-e89b-12d3-a456-426614174000'; // mock uuid

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication<NestFastifyApplication>(
      new FastifyAdapter(),
    );
    
    // Setup Redis Adapter for WebSockets
    const redisIoAdapter = new RedisIoAdapter(app);
    await redisIoAdapter.connectToRedis();
    app.useWebSocketAdapter(redisIoAdapter);

    await app.init();
    await app.listen(0, '0.0.0.0'); // listen on random port

    jwtService = app.get(JwtService);
    gateway = app.get(NotificationGateway);
  });

  afterAll(async () => {
    if (socket) socket.disconnect();
    await app.close();
  });

  it('should connect, join room and receive sla_warning event', (done) => {
    const port = app.getHttpServer().address().port;
    
    const token = jwtService.sign({ tenantId }, { secret: process.env.JWT_SECRET || 'vendora_super_secret' });

    socket = io(`http://127.0.0.1:${port}`, {
      auth: { token },
      transports: ['websocket'],
      forceNew: true,
    });

    socket.on('connect', () => {
      // Wait a little for the server to process the connection and join room
      setTimeout(() => {
        // Trigger the event manually from the server side
        gateway.broadcastToTenant(tenantId, 'lead.sla_warning', {
          leadId: 'some-lead-id',
          message: 'Warning',
        });
      }, 200);
    });

    socket.on('lead.sla_warning', (data) => {
      expect(data.leadId).toBe('some-lead-id');
      expect(data.message).toBe('Warning');
      done();
    });

    socket.on('connect_error', (err) => {
      done(err);
    });
  });
});
