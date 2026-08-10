import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
// supertest workaround for jest
const req = require('supertest');

import { AppModule } from './../src/app.module';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import rawBody from 'fastify-raw-body';
import * as crypto from 'crypto';
import Redis from 'ioredis';

describe('WebhooksController (e2e)', () => {
  let app: NestFastifyApplication;
  let redisClient: Redis;

  beforeAll(async () => {
    process.env.WHATSAPP_APP_SECRET = 'test-secret';
    process.env.WHATSAPP_VERIFY_TOKEN = 'test-token';
    
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication<NestFastifyApplication>(
      new FastifyAdapter()
    );
    
    await app.register(rawBody as any, {
      field: 'rawBody',
      global: true,
      encoding: 'utf8',
      runFirst: true,
    });

    await app.init();
    await app.getHttpAdapter().getInstance().ready();

    redisClient = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379', 10),
      db: 2,
    });
  });

  afterAll(async () => {
    await redisClient.quit();
    await app.close();
  });

  afterEach(async () => {
    await redisClient.flushdb();
  });

  it('GET /api/v1/webhooks/whatsapp - Should verify hub challenge', () => {
    return req(app.getHttpServer())
      .get('/api/v1/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=test-token&hub.challenge=12345')
      .expect(200)
      .expect('12345');
  });

  it('POST /api/v1/webhooks/whatsapp - Should reject without signature', () => {
    return req(app.getHttpServer())
      .post('/api/v1/webhooks/whatsapp')
      .send({ test: 'payload' })
      .expect(401);
  });

  it('POST /api/v1/webhooks/whatsapp - Should accept valid signature in < 50ms', async () => {
    const payload = {
      object: 'whatsapp_business_account',
      entry: [{
        changes: [{
          value: {
            messages: [{ id: 'wamid.test.123' }]
          }
        }]
      }]
    };
    const bodyStr = JSON.stringify(payload);
    const signature = `sha256=${crypto.createHmac('sha256', 'test-secret').update(bodyStr, 'utf8').digest('hex')}`;

    const start = Date.now();
    
    await req(app.getHttpServer())
      .post('/api/v1/webhooks/whatsapp')
      .set('x-hub-signature-256', signature)
      .set('Content-Type', 'application/json')
      .send(bodyStr) // Send as string to ensure raw body matches
      .expect(200);

    const end = Date.now();
    expect(end - start).toBeLessThan(50);
  });

  it('POST /api/v1/webhooks/whatsapp - Should handle idempotency correctly', async () => {
    const wamid = 'wamid.test.456';
    const payload = {
      object: 'whatsapp_business_account',
      entry: [{
        changes: [{
          value: {
            messages: [{ id: wamid }]
          }
        }]
      }]
    };
    const bodyStr = JSON.stringify(payload);
    const signature = `sha256=${crypto.createHmac('sha256', 'test-secret').update(bodyStr, 'utf8').digest('hex')}`;

    // First request should save idempotency key
    await req(app.getHttpServer())
      .post('/api/v1/webhooks/whatsapp')
      .set('x-hub-signature-256', signature)
      .set('Content-Type', 'application/json')
      .send(bodyStr)
      .expect(200);
      
    // Await for async operations to complete inside the controller
    await new Promise(resolve => setTimeout(resolve, 100));

    const key = `whatsapp:msg:${wamid}`;
    const exists = await redisClient.exists(key);
    expect(exists).toBe(1);

    // Second request should also return 200, but logic inside would be skipped (idempotency caught)
    // Checking the immediate 200 OK. E2E might require deeper introspection to verify queue wasn't pushed again.
    await req(app.getHttpServer())
      .post('/api/v1/webhooks/whatsapp')
      .set('x-hub-signature-256', signature)
      .set('Content-Type', 'application/json')
      .send(bodyStr)
      .expect(200);
  });
});
