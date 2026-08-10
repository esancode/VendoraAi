import { Test, TestingModule } from '@nestjs/testing';
import { IntelligencePipelineProcessor } from './intelligence-pipeline.processor';
import { PrismaService } from '../prisma/prisma.service';
import { AiOrchestratorService } from './ai-orchestrator.service';
import { GuardrailService } from '../security/guardrail.service';
import { SanitizerService } from '../security/sanitizer.service';
import { NotificationGateway } from '../notifications/notification.gateway';
import { getQueueToken } from '@nestjs/bullmq';
import { LeadStatus } from '@prisma/client';

jest.mock('ai', () => ({
  generateObject: jest.fn(),
  generateText: jest.fn(),
  tool: jest.fn().mockImplementation((opts) => opts),
}));
jest.mock('@ai-sdk/google', () => ({
  google: jest.fn().mockReturnValue('mock-google-model'),
}));
jest.mock('@ai-sdk/openai', () => ({
  openai: jest.fn().mockReturnValue('mock-openai-model'),
}));

describe('IntelligencePipelineProcessor', () => {
  let processor: IntelligencePipelineProcessor;
  let aiOrchestrator: jest.Mocked<AiOrchestratorService>;
  let notificationGateway: jest.Mocked<NotificationGateway>;
  let whatsappQueue: any;
  let prismaService: any;
  let guardrailService: jest.Mocked<GuardrailService>;
  let sanitizerService: jest.Mocked<SanitizerService>;

  beforeEach(async () => {
    aiOrchestrator = {
      analyzeConversation: jest.fn(),
      generateReplyDraft: jest.fn(),
    } as any;

    notificationGateway = {
      broadcastToTenant: jest.fn(),
    } as any;

    whatsappQueue = {
      add: jest.fn(),
    };

    guardrailService = {
      validateDraft: jest.fn().mockReturnValue(true),
    } as any;

    sanitizerService = {
      unmask: jest.fn().mockImplementation(async (draft) => draft),
    } as any;

    prismaService = {
      runInTenantContext: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IntelligencePipelineProcessor,
        { provide: PrismaService, useValue: prismaService },
        { provide: AiOrchestratorService, useValue: aiOrchestrator },
        { provide: GuardrailService, useValue: guardrailService },
        { provide: SanitizerService, useValue: sanitizerService },
        { provide: NotificationGateway, useValue: notificationGateway },
        { provide: getQueueToken('whatsapp-outbound'), useValue: whatsappQueue },
      ],
    }).compile();

    processor = module.get<IntelligencePipelineProcessor>(IntelligencePipelineProcessor);
  });

  it('should trigger HITL when confidence is low in autonomous mode', async () => {
    const jobData = { tenantId: 'tenant-1', leadId: 'lead-1', messageId: 'msg-1' };
    
    aiOrchestrator.analyzeConversation.mockResolvedValue({
      classification: { status: 'ONGOING', confidenceScore: 0.8 }, // < 0.85
      usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 },
    } as any);
    
    aiOrchestrator.generateReplyDraft.mockResolvedValue('Draft with low confidence');

    const mockTx = {
      conversation: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'conv-1',
          messages: [{ sender: 'CUSTOMER', maskedContent: 'test' }],
        }),
      },
      agent: { findUnique: jest.fn().mockResolvedValue({ status: true }) },
      lead: { update: jest.fn() },
      usageLog: { create: jest.fn() },
    };

    prismaService.runInTenantContext.mockImplementation(async (tenantId, cb) => cb(mockTx));

    await processor.process({ data: jobData } as any);

    expect(mockTx.lead.update).toHaveBeenCalledWith({
      where: { id: 'lead-1' },
      data: { status: LeadStatus.MANUAL_INTERVENTION_REQUIRED, needsHumanReview: true },
    });
    expect(notificationGateway.broadcastToTenant).toHaveBeenCalledWith(
      'tenant-1',
      'lead.manual_intervention_required',
      expect.any(Object)
    );
    expect(whatsappQueue.add).not.toHaveBeenCalled();
  });

  it('should schedule autonomous dispatch when confidence is high and guardrails pass', async () => {
    const jobData = { tenantId: 'tenant-1', leadId: 'lead-1', messageId: 'msg-1' };
    
    aiOrchestrator.analyzeConversation.mockResolvedValue({
      classification: { status: 'ONGOING', confidenceScore: 0.95 }, // >= 0.85
      usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 },
    } as any);
    
    aiOrchestrator.generateReplyDraft.mockResolvedValue('Draft with high confidence');

    const mockTx = {
      conversation: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'conv-1',
          messages: [{ sender: 'CUSTOMER', maskedContent: 'test' }],
        }),
      },
      agent: { findUnique: jest.fn().mockResolvedValue({ status: true }) },
      lead: { update: jest.fn() },
      usageLog: { create: jest.fn() },
    };

    prismaService.runInTenantContext.mockImplementation(async (tenantId, cb) => cb(mockTx));

    await processor.process({ data: jobData } as any);

    expect(whatsappQueue.add).toHaveBeenCalledWith(
      'send-message',
      expect.objectContaining({ content: 'Draft with high confidence' }),
      expect.objectContaining({ delay: expect.any(Number) })
    );
    expect(mockTx.lead.update).not.toHaveBeenCalled();
    expect(notificationGateway.broadcastToTenant).not.toHaveBeenCalled();
  });
});
