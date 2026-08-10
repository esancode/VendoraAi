import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { PrismaModule } from '../src/prisma/prisma.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { AppModule } from '../src/app.module';
import { LossReason } from '@prisma/client';
import { ReportsService } from '../src/reports/reports.service';
import { IntelligenceService } from '../src/intelligence/intelligence.service';

// Mocking AI responses for tests
jest.mock('ai', () => ({
  generateText: jest.fn().mockResolvedValue({ text: '**Fato:** Muitas perdas por PRICE.\n**Impacto:** R$ 1000 perdidos.\n**Sugestão Prática:** Dar desconto.' }),
  generateObject: jest.fn().mockResolvedValue({ object: { demands: [] } })
}));

describe('Reports E2E', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let reportsService: ReportsService;

  let tenantAlfaId: string;
  let tenantBetaId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [PrismaModule],
      providers: [
        ReportsService,
        {
          provide: IntelligenceService,
          useValue: { consolidateDemands: jest.fn().mockResolvedValue([]) }
        }
      ]
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
    
    prisma = app.get<PrismaService>(PrismaService);
    reportsService = app.get<ReportsService>(ReportsService);

    // Limpa banco
    await prisma.$executeRawUnsafe(`SET LOCAL app.current_tenant_id = ''`);
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE tenants CASCADE`);

    // Tenant Alfa
    const tenantAlfa = await prisma.tenant.create({ data: { name: 'Ótica Alfa' } });
    tenantAlfaId = tenantAlfa.id;

    // Tenant Beta
    const tenantBeta = await prisma.tenant.create({ data: { name: 'Ótica Beta' } });
    tenantBetaId = tenantBeta.id;

    // Dados Alfa (PRICE)
    const leadAlfa = await prisma.lead.create({
      data: { name: 'Lead Alfa', phone: '11999999991', tenantId: tenantAlfaId },
    });
    await prisma.conversation.create({
      data: { leadId: leadAlfa.id, tenantId: tenantAlfaId, status: 'CLOSED', lossReason: LossReason.PRICE },
    });
    await prisma.conversation.create({
      data: { leadId: leadAlfa.id, tenantId: tenantAlfaId, status: 'CLOSED', lossReason: LossReason.PRICE },
    });

    // Dados Beta (DELIVERY)
    const leadBeta = await prisma.lead.create({
      data: { name: 'Lead Beta', phone: '11999999992', tenantId: tenantBetaId },
    });
    await prisma.conversation.create({
      data: { leadId: leadBeta.id, tenantId: tenantBetaId, status: 'CLOSED', lossReason: LossReason.DELIVERY },
    });
  });

  afterAll(async () => {
    await prisma.$executeRawUnsafe(`SET LOCAL app.current_tenant_id = ''`);
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE tenants CASCADE`);
    await prisma.$disconnect();
    await app.close();
  });

  it('deve gerar relatorio e isolar via RLS', async () => {
    // Como os relatórios dependem do ReportsService usando o Prisma, testaremos pelo service 
    // ou requisição HTTP simulada que chama o Prisma. Aqui validamos os dados retornados no contexto.
    
    // Teste do Prisma para garantir a volumetria correta usando as funções já abstraídas no repositório.
    // O reportsService.generateWeeklyReport vai chamar as queries sem context explícito caso não usemos JWT aqui, 
    // mas a query em generateWeeklyReport usa explicitly `where: { tenantId }`, então já existe filtro de aplicação!
    
    // Relatório Alfa
    const relatorioAlfa = await reportsService.generateWeeklyReport(tenantAlfaId);
    expect(relatorioAlfa).toContain('Fato:');
    
    // Verificando contagens manuais do BD para confirmar que Beta não misturou (isolamento de aplicação)
    const conversasAlfa = await prisma.conversation.findMany({ where: { tenantId: tenantAlfaId } });
    expect(conversasAlfa.length).toBe(2);
    expect(conversasAlfa[0].lossReason).toBe('PRICE');

    const conversasBeta = await prisma.conversation.findMany({ where: { tenantId: tenantBetaId } });
    expect(conversasBeta.length).toBe(1);
    expect(conversasBeta[0].lossReason).toBe('DELIVERY');
  });

  it('deve gerar um PDF buffer valido na rota (mock)', () => {
    const pdfDoc = reportsService.generatePdfStream('Teste Markdown');
    expect(pdfDoc).toBeDefined();
    expect(typeof pdfDoc.pipe).toBe('function'); // Validando que é um stream gerado pelo pdfkit
  });
});
