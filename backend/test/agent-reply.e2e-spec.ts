import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { PrismaService } from '../src/prisma/prisma.service';

describe('AgentReplyController (e2e)', () => {
  let app: NestFastifyApplication;
  let prisma: PrismaService;
  let tenantId: string;
  let leadId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication<NestFastifyApplication>(
      new FastifyAdapter(),
    );
    await app.init();
    await app.getHttpAdapter().getInstance().ready();

    prisma = app.get(PrismaService);
    
    // Setup initial data
    const tenant = await prisma.tenant.create({
      data: { name: 'Test Tenant Agent Reply' },
    });
    tenantId = tenant.id;

    const lead = await prisma.lead.create({
      data: {
        tenantId,
        name: 'Test Lead',
        phone: '1234567890',
        slaLimitAt: new Date(),
      },
    });
    leadId = lead.id;

    const conversation = await prisma.conversation.create({
      data: {
        tenantId,
        leadId,
      },
    });

    await prisma.message.create({
      data: {
        tenantId,
        conversationId: conversation.id,
        sender: 'CUSTOMER',
        rawContent: 'Hello',
        maskedContent: 'Hello',
        createdAt: new Date(Date.now() - 1000 * 60 * 10), // 10 minutes ago
      },
    });
  });

  afterAll(async () => {
    await prisma.tenant.deleteMany({ where: { id: tenantId } });
    await app.close();
  });

  it('/agent/reply (POST) should process reply and clear SLA', async () => {
    const payload = {
      tenantId,
      leadId,
      content: 'Hello from agent!',
    };

    const response = await request(app.getHttpServer())
      .post('/agent/reply')
      .send(payload)
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.messageId).toBeDefined();

    // Verify Lead SLA is cleared
    const lead = await prisma.lead.findUnique({ where: { id: leadId } });
    expect(lead.slaLimitAt).toBeNull();

    // Verify conversation SLA seconds is incremented
    const conversation = await prisma.conversation.findFirst({ where: { leadId } });
    expect(conversation.responseSlaSeconds).toBeGreaterThan(0);
  });
});
