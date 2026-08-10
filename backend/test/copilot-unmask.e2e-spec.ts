import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { PrismaService } from '../src/prisma/prisma.service';
import { IntelligencePipelineProcessor } from '../src/intelligence/intelligence-pipeline.processor';
import { AiOrchestratorService } from '../src/intelligence/ai-orchestrator.service';
import { SanitizerService } from '../src/security/sanitizer.service';
import { GuardrailService } from '../src/security/guardrail.service';
import { NotificationGateway } from '../src/notifications/notification.gateway';
import { ConversationStatus, LeadStatus } from '@prisma/client';
import * as crypto from 'crypto';

describe('Copilot Unmask E2E', () => {
  let app: INestApplication;
  let processor: IntelligencePipelineProcessor;
  let prisma: PrismaService;
  let aiOrchestrator: AiOrchestratorService;
  let notificationGateway: NotificationGateway;
  let sanitizerService: SanitizerService;

  beforeAll(async () => {
    // Mock the external AI service
    const mockAiOrchestrator = {
      analyzeConversation: jest.fn().mockResolvedValue({
        classification: {
          status: 'ONGOING', // Ensures conversation stays OPEN and draft is generated
          reasonCategory: null,
          confidenceScore: 0.9,
          semanticAnalysis: 'Continua',
          unmappedDemands: [],
        },
        usage: { totalTokens: 10 },
      }),
      generateReplyDraft: jest.fn(),
    };

    const mockNotificationGateway = {
      broadcastToTenant: jest.fn(),
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      providers: [
        IntelligencePipelineProcessor,
        { provide: AiOrchestratorService, useValue: mockAiOrchestrator },
        GuardrailService,
        SanitizerService,
        { provide: NotificationGateway, useValue: mockNotificationGateway },
        PrismaService,
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    processor = moduleFixture.get<IntelligencePipelineProcessor>(IntelligencePipelineProcessor);
    prisma = moduleFixture.get<PrismaService>(PrismaService);
    aiOrchestrator = moduleFixture.get<AiOrchestratorService>(AiOrchestratorService);
    notificationGateway = moduleFixture.get<NotificationGateway>(NotificationGateway);
    sanitizerService = moduleFixture.get<SanitizerService>(SanitizerService);
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await app.close();
  });

  it('should mask PII, generate draft with mask, unmask it and broadcast', async () => {
    const tenantId = crypto.randomUUID();
    const leadId = crypto.randomUUID();
    const messageId = crypto.randomUUID();

    // 1. Setup Database
    await prisma.tenant.create({
      data: {
        id: tenantId,
        name: 'Test Tenant E2E',
      },
    });

    await prisma.lead.create({
      data: {
        id: leadId,
        tenantId,
        name: 'John Doe',
        phone: `119${crypto.randomBytes(4).toString('hex').slice(0, 8)}`,
        status: LeadStatus.NEW,
      },
    });

    const conversation = await prisma.conversation.create({
      data: {
        tenantId,
        leadId,
        status: ConversationStatus.OPEN,
      },
    });

    // Simulated original customer message with CPF
    const originalText = 'Meu CPF é 123.456.789-00';
    
    // 2. Sanitize (this mocks what WhatsappIngestionProcessor does)
    const maskedContent = await sanitizerService.sanitize(originalText, tenantId, messageId);

    // Assert that the text was masked
    expect(maskedContent).toContain('CPF_MASKED_');
    expect(maskedContent).not.toContain('123.456.789-00');

    // Save message in DB
    await prisma.message.create({
      data: {
        id: messageId,
        conversationId: conversation.id,
        tenantId,
        sender: 'CUSTOMER',
        rawContent: 'ENCRYPTED_BLOB', // Not used in this test
        maskedContent: maskedContent,
      },
    });

    // 3. Mock AI to use the mask in its draft
    const extractMask = maskedContent.match(/\[CPF_MASKED_[A-Z0-9]+\]/)[0];
    (aiOrchestrator.generateReplyDraft as jest.Mock).mockResolvedValue(
      `Obrigado! Localizamos seu cadastro com o CPF ${extractMask}. Em que posso ajudar?`
    );

    // 4. Run the Pipeline Processor
    const job = { data: { tenantId, leadId, messageId } } as any;
    await processor.process(job);

    // 5. Verify broadcasting and unmasking
    expect(notificationGateway.broadcastToTenant).toHaveBeenCalledWith(
      tenantId,
      'lead.draft_suggested',
      expect.objectContaining({
        leadId,
        conversationId: conversation.id,
        // The broadcast draft MUST contain the real CPF, not the mask
        draft: 'Obrigado! Localizamos seu cadastro com o CPF 123.456.789-00. Em que posso ajudar?',
      })
    );
  });
});
