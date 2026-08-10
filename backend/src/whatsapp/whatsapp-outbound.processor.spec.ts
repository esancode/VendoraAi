import { Test, TestingModule } from '@nestjs/testing';
import { WhatsappOutboundProcessor } from './whatsapp-outbound.processor';
import { PrismaService } from '../prisma/prisma.service';
import { Logger } from '@nestjs/common';
import { LeadStatus, MessageSender } from '@prisma/client';
import { Job } from 'bullmq';

describe('WhatsappOutboundProcessor', () => {
  let processor: WhatsappOutboundProcessor;
  let prismaService: jest.Mocked<PrismaService>;

  beforeEach(async () => {
    prismaService = {
      runInTenantContext: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WhatsappOutboundProcessor,
        {
          provide: PrismaService,
          useValue: prismaService,
        },
      ],
    }).compile();

    processor = module.get<WhatsappOutboundProcessor>(WhatsappOutboundProcessor);
  });

  it('should process job and create message if lead is still in automated mode', async () => {
    const jobData = {
      tenantId: 'tenant-1',
      leadId: 'lead-1',
      conversationId: 'conv-1',
      content: 'Hello World',
    };
    
    const job = { data: jobData } as Job<any, any, string>;
    const mockTx = {
      lead: {
        findUnique: jest.fn().mockResolvedValue({ id: 'lead-1', status: LeadStatus.ACTIVE }),
      },
      message: {
        create: jest.fn(),
      },
    };

    prismaService.runInTenantContext.mockImplementation(async (tenantId, cb) => cb(mockTx as any));

    await processor.process(job);

    expect(mockTx.lead.findUnique).toHaveBeenCalledWith({ where: { id: 'lead-1' } });
    expect(mockTx.message.create).toHaveBeenCalledWith({
      data: {
        conversationId: 'conv-1',
        tenantId: 'tenant-1',
        sender: MessageSender.SYSTEM,
        rawContent: 'Hello World',
        maskedContent: 'Hello World',
      },
    });
  });

  it('should abort if lead is not found', async () => {
    const jobData = { tenantId: 'tenant-1', leadId: 'lead-1', conversationId: 'conv-1', content: 'test' };
    const job = { data: jobData } as Job<any, any, string>;
    const mockTx = {
      lead: { findUnique: jest.fn().mockResolvedValue(null) },
      message: { create: jest.fn() },
    };
    prismaService.runInTenantContext.mockImplementation(async (tenantId, cb) => cb(mockTx as any));

    await processor.process(job);

    expect(mockTx.message.create).not.toHaveBeenCalled();
  });

  it('should abort if lead status is MANUAL_INTERVENTION_REQUIRED', async () => {
    const jobData = { tenantId: 'tenant-1', leadId: 'lead-1', conversationId: 'conv-1', content: 'test' };
    const job = { data: jobData } as Job<any, any, string>;
    const mockTx = {
      lead: { findUnique: jest.fn().mockResolvedValue({ id: 'lead-1', status: LeadStatus.MANUAL_INTERVENTION_REQUIRED }) },
      message: { create: jest.fn() },
    };
    prismaService.runInTenantContext.mockImplementation(async (tenantId, cb) => cb(mockTx as any));

    await processor.process(job);

    expect(mockTx.message.create).not.toHaveBeenCalled();
  });
});
