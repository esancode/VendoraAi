import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../src/prisma/prisma.service';
import { IntelligencePipelineProcessor } from '../src/intelligence/intelligence-pipeline.processor';
import { AiOrchestratorService } from '../src/intelligence/ai-orchestrator.service';
import { ConversationStatus, LeadStatus, LossReason, MessageSender } from '@prisma/client';

describe('IntelligencePipelineProcessor (e2e)', () => {
  let processor: IntelligencePipelineProcessor;
  let prisma: PrismaService;
  let aiOrchestrator: AiOrchestratorService;
  
  let tenantId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      providers: [
        PrismaService,
        AiOrchestratorService,
        IntelligencePipelineProcessor,
      ],
    }).compile();

    processor = moduleFixture.get<IntelligencePipelineProcessor>(IntelligencePipelineProcessor);
    prisma = moduleFixture.get<PrismaService>(PrismaService);
    aiOrchestrator = moduleFixture.get<AiOrchestratorService>(AiOrchestratorService);

    // Setup Test Data
    const tenant = await prisma.tenant.create({
      data: { name: 'AI Test Tenant' },
    });
    tenantId = tenant.id;
  });

  afterAll(async () => {
    await prisma.tenant.deleteMany({ where: { id: tenantId } });
    await prisma.$disconnect();
  });

  it('should process a lost conversation and update lead status, conversation and usage log', async () => {
    // 1. Arrange - Setup Lead, Conversation, Messages
    const lead = await prisma.lead.create({
      data: {
        tenantId,
        name: 'John Doe',
        phone: '123456789',
        status: LeadStatus.ACTIVE,
      }
    });

    const conversation = await prisma.conversation.create({
      data: {
        tenantId,
        leadId: lead.id,
        status: ConversationStatus.OPEN,
      }
    });

    await prisma.message.create({
      data: {
        tenantId,
        conversationId: conversation.id,
        sender: MessageSender.CUSTOMER,
        maskedContent: 'Achei o produto muito caro, não vou querer.',
        rawContent: 'Achei o produto muito caro, não vou querer.',
      }
    });

    // Mock AI Orchestrator
    jest.spyOn(aiOrchestrator, 'analyzeConversation').mockResolvedValue({
      classification: {
        status: 'LOST',
        reasonCategory: 'PRICE',
        confidenceScore: 0.95,
        semanticAnalysis: 'Cliente desistiu por causa do preço',
        unmappedDemands: [],
      },
      usage: { promptTokens: 50, completionTokens: 10, totalTokens: 60 },
    });

    const jobMock = {
      data: {
        tenantId,
        leadId: lead.id,
        messageId: 'mock-id',
      }
    } as any;

    // 2. Act
    await processor.process(jobMock);

    // 3. Assert
    // Check Lead
    const updatedLead = await prisma.lead.findUnique({ where: { id: lead.id } });
    expect(updatedLead?.status).toBe(LeadStatus.LOST);
    expect(updatedLead?.needsHumanReview).toBe(false);

    // Check Conversation
    const updatedConv = await prisma.conversation.findUnique({ where: { id: conversation.id } });
    expect(updatedConv?.status).toBe(ConversationStatus.CLOSED);
    expect(updatedConv?.lossReason).toBe(LossReason.PRICE);
    expect(updatedConv?.lossReasonDetail).toBe('Cliente desistiu por causa do preço');
    expect(Number(updatedConv?.confidenceScore)).toBe(0.95);

    // Check FinOps (Usage Log)
    const date = new Date();
    const billingPeriodYm = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    const usageLogs = await prisma.usageLog.findMany({
      where: { tenantId, billingPeriodYm }
    });
    
    expect(usageLogs.length).toBeGreaterThan(0);
    expect(usageLogs[0].tokenCount).toBe(60);
  });
  
  it('should flag for human review if confidence score is low', async () => {
    // 1. Arrange - Setup Lead, Conversation, Messages
    const lead = await prisma.lead.create({
      data: {
        tenantId,
        name: 'Jane Smith',
        phone: '987654321',
        status: LeadStatus.ACTIVE,
      }
    });

    const conversation = await prisma.conversation.create({
      data: {
        tenantId,
        leadId: lead.id,
        status: ConversationStatus.OPEN,
      }
    });

    await prisma.message.create({
      data: {
        tenantId,
        conversationId: conversation.id,
        sender: MessageSender.CUSTOMER,
        maskedContent: 'Não sei se vou querer, vou pensar.',
        rawContent: 'Não sei',
      }
    });

    // Mock AI Orchestrator
    jest.spyOn(aiOrchestrator, 'analyzeConversation').mockResolvedValue({
      classification: {
        status: 'LOST', // IA achou que é LOST, mas score tá baixo
        reasonCategory: 'OTHER',
        confidenceScore: 0.60,
        semanticAnalysis: 'Indecisão',
        unmappedDemands: [],
      },
      usage: { promptTokens: 10, completionTokens: 10, totalTokens: 20 },
    });

    const jobMock = {
      data: {
        tenantId,
        leadId: lead.id,
        messageId: 'mock-id',
      }
    } as any;

    // 2. Act
    await processor.process(jobMock);

    // 3. Assert
    const updatedLead = await prisma.lead.findUnique({ where: { id: lead.id } });
    expect(updatedLead?.status).toBe(LeadStatus.LOST);
    expect(updatedLead?.needsHumanReview).toBe(true);

    const updatedConv = await prisma.conversation.findUnique({ where: { id: conversation.id } });
    expect(updatedConv?.status).toBe(ConversationStatus.CLOSED);
    expect(updatedConv?.lossReason).toBe(LossReason.OTHER);
  });
});
