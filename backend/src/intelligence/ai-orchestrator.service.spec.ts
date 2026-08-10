import { Test, TestingModule } from '@nestjs/testing';
import { AiOrchestratorService } from './ai-orchestrator.service';
import { KnowledgeService } from './knowledge.service';
import { generateObject, generateText } from 'ai';
import { PrismaService } from '../prisma/prisma.service';

// Mock dependências externas
jest.mock('@ai-sdk/google', () => ({
  google: jest.fn().mockReturnValue('mock-google-model'),
}));
jest.mock('ai', () => ({
  generateObject: jest.fn(),
  generateText: jest.fn(),
  tool: jest.fn().mockImplementation((opts) => opts),
}));
jest.mock('@ai-sdk/openai', () => ({
  openai: jest.fn().mockReturnValue('mock-openai-model'),
}));

describe('AiOrchestratorService', () => {
  let service: AiOrchestratorService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiOrchestratorService,
        {
          provide: KnowledgeService,
          useValue: {
            searchRelevantChunks: jest.fn().mockResolvedValue([]),
          },
        },
        {
          provide: PrismaService, // Provide a mock for PrismaService
          useValue: {
            runInTenantContext: jest.fn((tenantId, cb) => cb({
              agent: {
                findUnique: jest.fn().mockResolvedValue(null)
              }
            })),
          }
        }
      ],
    }).compile();

    service = module.get<AiOrchestratorService>(AiOrchestratorService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should successfully analyze conversation and return structured object', async () => {
    const mockResponse = {
      object: {
        status: 'LOST',
        reasonCategory: 'PRICE',
        confidenceScore: 0.95,
        semanticAnalysis: 'O cliente achou o frete muito caro.',
        unmappedDemands: [],
      },
      usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
    };

    (generateObject as jest.Mock).mockResolvedValue(mockResponse);

    const history = '[CUSTOMER]: achei o frete caro, vou desistir.';
    const result = await service.analyzeConversation(history);

    expect(generateObject).toHaveBeenCalledTimes(1);
    expect(result.classification.status).toBe('LOST');
    expect(result.classification.reasonCategory).toBe('PRICE');
    expect(result.classification.confidenceScore).toBe(0.95);
    expect(result.usage.totalTokens).toBe(30);
  });

  it('should fallback to secondary model on failure', async () => {
    const mockResponse = {
      object: {
        status: 'WON',
        reasonCategory: null,
        confidenceScore: 0.9,
        semanticAnalysis: 'Cliente confirmou compra.',
        unmappedDemands: [],
      },
      usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
    };

    // Primeira chamada falha (Gemini)
    (generateObject as jest.Mock)
      .mockRejectedValueOnce(new Error('Rate limit exceeded'))
      // Segunda chamada sucesso (GPT-4o)
      .mockResolvedValueOnce(mockResponse);

    const history = '[CUSTOMER]: sim, vou querer.';
    const result = await service.analyzeConversation(history);

    expect(generateObject).toHaveBeenCalledTimes(2);
    expect(result.classification.status).toBe('WON');
  });

  it('should throw error if both models fail', async () => {
    (generateObject as jest.Mock)
      .mockRejectedValueOnce(new Error('Rate limit exceeded 1'))
      .mockRejectedValueOnce(new Error('Rate limit exceeded 2'));

    await expect(service.analyzeConversation('teste')).rejects.toThrow('Falha em ambos os modelos de IA');
  });

  describe('generateReplyDraft', () => {
    it('should generate a reply draft successfully', async () => {
      (generateText as jest.Mock).mockResolvedValue({
        text: 'Olá! Como posso ajudar com sua compra de calçados?',
      });

      const draft = await service.generateReplyDraft('History here');
      
      expect(draft).toBe('Olá! Como posso ajudar com sua compra de calçados?');
      expect(generateText).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'mock-google-model',
          messages: expect.arrayContaining([
            expect.objectContaining({
              role: 'user',
              content: expect.stringContaining('History here'),
            }),
          ]),
        })
      );
    });

    it('should compile agent context, onboarding formatting, and Few-Shot examples in the prompt correctly', async () => {
      (generateText as jest.Mock).mockResolvedValue({
        text: 'E aí chapa! Temos a bota sim.',
      });

      const mockAgentData = {
        id: 'agent-id',
        tenantId: 'tenant-123',
        name: 'Vendedor Teste',
        status: true,
        onboardingAnswers: {
          'Qual seu público?': 'Jovens',
          'Produto principal': 'Botas',
        },
        basePrompt: 'Seja bem animado.',
        temperature: '0.8',
        examples: [
          { userQuery: 'tem bota?', expectedResponse: 'E aí chapa! Temos sim.' },
        ],
      };

      // Sobrescrevendo temporariamente o mock para este teste
      const prismaMock = service['prisma'];
      jest.spyOn(prismaMock, 'runInTenantContext').mockImplementationOnce(async (tenantId, cb) => {
        return cb({
          agent: {
            findUnique: jest.fn().mockResolvedValue(mockAgentData),
          },
        } as any);
      });

      const draft = await service.generateReplyDraft('History real', 'tenant-123');

      expect(draft).toBe('E aí chapa! Temos a bota sim.');
      expect(generateText).toHaveBeenCalledWith(
        expect.objectContaining({
          system: expect.stringContaining('- Qual seu público?: Jovens'),
          messages: expect.arrayContaining([
            expect.objectContaining({ role: 'user', content: 'tem bota?' }),
            expect.objectContaining({ role: 'assistant', content: 'E aí chapa! Temos sim.' }),
            expect.objectContaining({ role: 'user', content: expect.stringContaining('History real') }),
          ]),
        })
      );
    });

    it('should inject RAG knowledge into the system prompt when chunks are found', async () => {
      const mockKnowledgeService = service['knowledgeService'];
      (mockKnowledgeService.searchRelevantChunks as jest.Mock).mockResolvedValue(['Chunk 1: Regra X', 'Chunk 2: Regra Y']);
      
      (generateText as jest.Mock).mockResolvedValue({
        text: 'Resposta com RAG.',
      });

      const prismaMock = service['prisma'];
      jest.spyOn(prismaMock, 'runInTenantContext').mockImplementationOnce(async (tenantId, cb) => {
        return cb({
          agent: {
            findUnique: jest.fn().mockResolvedValue({ id: 'agent-123' }),
          },
        } as any);
      });

      await service.generateReplyDraft('[CUSTOMER]: dúvida técnica', 'tenant-123');

      expect(mockKnowledgeService.searchRelevantChunks).toHaveBeenCalledWith('tenant-123', '[CUSTOMER]: dúvida técnica', 3);
      
      // Valida se o RAG foi parar no systemPrompt
      expect(generateText).toHaveBeenCalledWith(
        expect.objectContaining({
          system: expect.stringContaining('[BASE_DE_CONHECIMENTO_DA_EMPRESA]'),
        })
      );
      expect(generateText).toHaveBeenCalledWith(
        expect.objectContaining({
          system: expect.stringContaining('Chunk 1: Regra X'),
        })
      );
    });

    it('should inject tools when useTools is true', async () => {
      (generateText as jest.Mock).mockResolvedValue({
        text: 'O frete fica R$ 15,90.',
      });

      const draft = await service.generateReplyDraft('History here', undefined, true);
      
      expect(draft).toBe('O frete fica R$ 15,90.');
      expect(generateText).toHaveBeenCalledWith(
        expect.objectContaining({
          tools: expect.objectContaining({
            verificarEstoque: expect.anything(),
            consultarFrete: expect.anything(),
            criarLinkPagamento: expect.anything(),
          }),
          maxSteps: 3,
        })
      );
    });

    it('should throw an error if generation fails', async () => {
      (generateText as jest.Mock).mockRejectedValue(new Error('API error'));

      await expect(service.generateReplyDraft('History here')).rejects.toThrow('Falha na geração de rascunho (Copiloto)');
    });
  });
});
