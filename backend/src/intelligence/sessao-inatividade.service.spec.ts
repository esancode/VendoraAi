import { Test, TestingModule } from '@nestjs/testing';
import { SessaoInatividadeService } from './sessao-inatividade.service';
import { PrismaService } from '../prisma/prisma.service';
import { AiOrchestratorService } from './ai-orchestrator.service';
import { ConversationStatus } from '@prisma/client';

describe('SessaoInatividadeService', () => {
  let service: SessaoInatividadeService;
  let prisma: PrismaService;
  let aiOrchestrator: AiOrchestratorService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SessaoInatividadeService,
        {
          provide: PrismaService,
          useValue: {
            lead: {
              findMany: jest.fn(),
              update: jest.fn(),
            },
            $transaction: jest.fn(async (cb) => {
               const tx = {
                 conversation: { update: jest.fn() },
                 lead: { update: jest.fn() }
               };
               return cb(tx);
            }),
          },
        },
        {
          provide: AiOrchestratorService,
          useValue: {
            generateConversationalSummary: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<SessaoInatividadeService>(SessaoInatividadeService);
    prisma = module.get<PrismaService>(PrismaService);
    aiOrchestrator = module.get<AiOrchestratorService>(AiOrchestratorService);
  });

  it('deve fechar conversas inativas e gerar o resumo', async () => {
    const mockLead = {
      id: 'lead-1',
      tenantId: 'tenant-1',
      conversations: [
        { id: 'conv-1', status: ConversationStatus.OPEN }
      ]
    };

    (prisma.lead.findMany as jest.Mock).mockResolvedValue([mockLead]);
    (aiOrchestrator.generateConversationalSummary as jest.Mock).mockResolvedValue('Resumo gerado pelo Gemini.');

    await service.checkInactiveConversations();

    expect(prisma.lead.findMany).toHaveBeenCalled();
    expect(aiOrchestrator.generateConversationalSummary).toHaveBeenCalledWith('conv-1', 'tenant-1');
    expect(prisma.$transaction).toHaveBeenCalled();
  });
});
