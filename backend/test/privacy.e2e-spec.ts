import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../src/prisma/prisma.service';
import { WhatsappIngestionProcessor } from '../src/webhooks/whatsapp-ingestion.processor';
import { AppModule } from '../src/app.module';

describe('Privacy & Security (E2E)', () => {
  let processor: WhatsappIngestionProcessor;
  let prisma: PrismaService;
  let testTenantId: string;
  const originalEnv = process.env;

  let app: any;

  beforeAll(async () => {
    // Setup encryption key
    process.env = { ...originalEnv };
    if (!process.env.ENCRYPTION_MASTER_KEY) {
      process.env.ENCRYPTION_MASTER_KEY = 'a'.repeat(64);
    }

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    processor = moduleFixture.get<WhatsappIngestionProcessor>(WhatsappIngestionProcessor);
    prisma = moduleFixture.get<PrismaService>(PrismaService);

    let tenant = await prisma.tenant.findFirst();
    if (!tenant) {
      tenant = await prisma.tenant.create({
        data: { name: 'Privacy Test Tenant' },
      });
    }
    testTenantId = tenant.id;
  });

  afterAll(async () => {
    process.env = originalEnv;
    if (app) await app.close();
    await prisma.$disconnect();
  });

  it('should encrypt PII in database and mask sensitive data', async () => {
    const rawPhone = `551199999${Math.floor(1000 + Math.random() * 9000)}`;
    const rawName = 'Joao Silva (Secret)';
    const rawMessage = 'Meu CPF é 999.888.777-66, por favor analise.';
    const wamid = `wamid.test.privacy.${Date.now()}`;

    const jobPayload = {
      object: 'whatsapp_business_account',
      entry: [{
        changes: [{
          value: {
            contacts: [{
              profile: { name: rawName }
            }],
            messages: [{
              id: wamid,
              from: rawPhone,
              text: { body: rawMessage },
              timestamp: Math.floor(Date.now() / 1000).toString()
            }]
          }
        }]
      }]
    };

    await processor.process({ data: jobPayload } as any);

    // Verify Database Row Directly using Prisma raw query to bypass any interceptors (if they existed)
    // Here we use Prisma standard query but check if the data returned matches our expectation of ciphertext
    const leads = await prisma.$queryRaw<any[]>`SELECT name, phone FROM leads WHERE tenant_id = ${testTenantId}::uuid ORDER BY created_at DESC LIMIT 1`;
    const lead = leads[0];

    expect(lead).toBeDefined();
    
    // Validate Encryption Format: iv:authTag:ciphertext
    expect(lead.phone).toContain(':');
    expect(lead.phone.split(':').length).toBe(3);
    expect(lead.phone).not.toContain(rawPhone);
    
    expect(lead.name).toContain(':');
    expect(lead.name.split(':').length).toBe(3);
    expect(lead.name).not.toContain(rawName);

    // Validate Sanitization on Message
    const messages = await prisma.$queryRaw<any[]>`
      SELECT raw_content, masked_content 
      FROM messages 
      WHERE tenant_id = ${testTenantId}::uuid 
      ORDER BY created_at DESC LIMIT 1
    `;
    const message = messages[0];

    expect(message).toBeDefined();
    expect(message.raw_content).toBe(rawMessage);
    expect(message.masked_content).toContain('[CPF_MASKED_');
    expect(message.masked_content).not.toContain('999.888.777-66');
  });
});
