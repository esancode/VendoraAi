import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../src/prisma/prisma.service';
import { WhatsappIngestionProcessor } from '../src/webhooks/whatsapp-ingestion.processor';
import { AppModule } from '../src/app.module';

describe('WhatsappIngestionProcessor (Integration)', () => {
  let processor: WhatsappIngestionProcessor;
  let prisma: PrismaService;
  let testTenantId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    processor = moduleFixture.get<WhatsappIngestionProcessor>(WhatsappIngestionProcessor);
    prisma = moduleFixture.get<PrismaService>(PrismaService);

    // Seed a tenant for testing if not exists
    let tenant = await prisma.tenant.findFirst();
    if (!tenant) {
      tenant = await prisma.tenant.create({
        data: {
          name: 'Test Tenant',
        },
      });
    }
    testTenantId = tenant.id;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('should process webhook and create lead, conversation, and message', async () => {
    const fromPhone = `551199999${Math.floor(1000 + Math.random() * 9000)}`;
    const wamid = `wamid.test.processor.${Date.now()}`;
    const text = 'Hello VendoraAI!';
    const timestampStr = Math.floor(Date.now() / 1000).toString();

    const jobPayload = {
      object: 'whatsapp_business_account',
      entry: [{
        changes: [{
          value: {
            contacts: [{
              profile: { name: 'Erick Test' }
            }],
            messages: [{
              id: wamid,
              from: fromPhone,
              text: { body: text },
              timestamp: timestampStr
            }]
          }
        }]
      }]
    };

    const fakeJob = {
      data: jobPayload
    } as any;

    await processor.process(fakeJob);

    // Validate if data was created properly using standard Prisma client
    const lead = await prisma.lead.findFirst({
      where: {
        tenantId: testTenantId,
        phone: fromPhone
      }
    });

    expect(lead).toBeDefined();
    expect(lead?.name).toBe('Erick Test');

    const conversation = await prisma.conversation.findFirst({
      where: {
        tenantId: testTenantId,
        leadId: lead!.id,
        status: 'OPEN'
      }
    });

    expect(conversation).toBeDefined();

    const message = await prisma.message.findFirst({
      where: {
        tenantId: testTenantId,
        conversationId: conversation!.id,
        rawContent: text
      }
    });

    expect(message).toBeDefined();
    expect(message?.maskedContent).toBe(text);
    expect(message?.sender).toBe('CUSTOMER');
  });
});
