import { Test, TestingModule } from '@nestjs/testing';
import { AiOrchestratorService } from '../src/intelligence/ai-orchestrator.service';
import { PrismaService } from '../src/prisma/prisma.service';
import * as crypto from 'crypto';
import * as aiModule from 'ai';

// Mock the ai package entirely for this test
jest.mock('ai', () => {
  return {
    generateText: jest.fn().mockResolvedValue({ text: 'Mocked reply' }),
    generateObject: jest.fn(),
  };
});

describe('AiOrchestratorService Few-Shot Integration', () => {
  let aiOrchestrator: AiOrchestratorService;
  let prisma: PrismaService;
  let tenantId: string;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AiOrchestratorService, PrismaService],
    }).compile();

    aiOrchestrator = module.get<AiOrchestratorService>(AiOrchestratorService);
    prisma = module.get<PrismaService>(PrismaService);

    tenantId = crypto.randomUUID();

    // Setup Test Tenant
    await prisma.tenant.create({
      data: { id: tenantId, name: 'AI Few-Shot Tenant' },
    });
  });

  afterAll(async () => {
    // Cleanup
    await prisma.tenant.delete({ where: { id: tenantId } });
    await prisma.$disconnect();
    jest.clearAllMocks();
  });

  it('should compile prompt dynamically and inject few-shot examples', async () => {
    // Insert Agent configurations and examples
    const agent = await prisma.agent.create({
      data: {
        tenantId,
        name: 'Agent Slang',
        basePrompt: 'Sempre fale como um surfista.',
        onboardingAnswers: { productInfo: 'Pranchas de Surf' },
        temperature: 0.8,
      },
    });

    await prisma.agentExample.createMany({
      data: [
        {
          agentId: agent.id,
          tenantId,
          userQuery: 'Qual o valor?',
          expectedResponse: 'E aí chapa! A prancha tá R$ 1000, altas ondas!',
        },
      ],
    });

    const history = '[CUSTOMER]: Qual o valor?';
    
    await aiOrchestrator.generateReplyDraft(history, tenantId);

    // Verify generateText was called with correct payload
    expect(aiModule.generateText).toHaveBeenCalled();
    const callArgs = (aiModule.generateText as jest.Mock).mock.calls[0][0];

    // Assert system prompt contains business rules
    expect(callArgs.system).toContain('Sempre fale como um surfista.');
    expect(callArgs.system).toContain('Pranchas de Surf');
    expect(callArgs.temperature).toBe(0.8);

    // Assert messages array contains the few-shot example as user/assistant turns
    const messages = callArgs.messages;
    expect(messages).toHaveLength(3); // 1 example (user + assistant) + 1 real history (user)
    
    expect(messages[0]).toEqual({ role: 'user', content: 'Qual o valor?' });
    expect(messages[1]).toEqual({ role: 'assistant', content: 'E aí chapa! A prancha tá R$ 1000, altas ondas!' });
    expect(messages[2].role).toBe('user');
    expect(messages[2].content).toContain(history);
  });
});
