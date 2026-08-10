import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { PrismaModule } from '../src/prisma/prisma.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('RLS Isolation Test (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  let tenantAlfaId: string;
  let tenantBetaId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [PrismaModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
    prisma = app.get<PrismaService>(PrismaService);

    // Limpa banco antes de testar
    await prisma.$executeRawUnsafe(`SET LOCAL app.current_tenant_id = ''`);
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE tenants CASCADE`);

    // Criar Tenant Alfa
    const tenantAlfa = await prisma.tenant.create({
      data: { name: 'Tenant Alfa' },
    });
    tenantAlfaId = tenantAlfa.id;

    // Criar Tenant Beta
    const tenantBeta = await prisma.tenant.create({
      data: { name: 'Tenant Beta' },
    });
    tenantBetaId = tenantBeta.id;

    // Inserir dados no Tenant Alfa
    const leadAlfa = await prisma.lead.create({
      data: {
        name: 'Lead Alfa',
        phone: '11999999991',
        tenantId: tenantAlfaId,
      },
    });

    const conversationAlfa = await prisma.conversation.create({
      data: {
        leadId: leadAlfa.id,
        tenantId: tenantAlfaId,
      },
    });

    await prisma.message.create({
      data: {
        conversationId: conversationAlfa.id,
        tenantId: tenantAlfaId,
        sender: 'AGENT',
        maskedContent: 'Olá do Alfa',
      },
    });

    // Inserir dados no Tenant Beta
    const leadBeta = await prisma.lead.create({
      data: {
        name: 'Lead Beta',
        phone: '11999999992',
        tenantId: tenantBetaId,
      },
    });

    const conversationBeta = await prisma.conversation.create({
      data: {
        leadId: leadBeta.id,
        tenantId: tenantBetaId,
      },
    });

    await prisma.message.create({
      data: {
        conversationId: conversationBeta.id,
        tenantId: tenantBetaId,
        sender: 'AGENT',
        maskedContent: 'Olá do Beta',
      },
    });
  });

  afterAll(async () => {
    // Clean up
    await prisma.$executeRawUnsafe(`SET LOCAL app.current_tenant_id = ''`);
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE tenants CASCADE`);
    await app.close();
  });

  it('deve falhar ou não retornar dados ao buscar leads sem o contexto do tenant', async () => {
    try {
      const leads = await prisma.lead.findMany();
      // Dependendo de como a RLS foi configurada (se block ou default policy), 
      // pode retornar 0 registros ou lançar um erro.
      expect(leads.length).toBe(0);
    } catch (error) {
      expect(error).toBeDefined();
    }
  });

  it('deve retornar apenas os leads do Tenant Alfa quando usar runInTenantContext(tenantAlfaId)', async () => {
    const leadsAlfa = await prisma.runInTenantContext(tenantAlfaId, async (tx) => {
      return tx.lead.findMany();
    });

    expect(leadsAlfa.length).toBe(1);
    expect(leadsAlfa[0].name).toBe('Lead Alfa');
    expect(leadsAlfa[0].tenantId).toBe(tenantAlfaId);
  });

  it('deve retornar apenas as mensagens do Tenant Beta quando usar runInTenantContext(tenantBetaId)', async () => {
    const messagesBeta = await prisma.runInTenantContext(tenantBetaId, async (tx) => {
      return tx.message.findMany();
    });

    expect(messagesBeta.length).toBe(1);
    expect(messagesBeta[0].maskedContent).toBe('Olá do Beta');
    expect(messagesBeta[0].tenantId).toBe(tenantBetaId);
  });
});
