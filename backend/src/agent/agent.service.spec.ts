import { Test, TestingModule } from '@nestjs/testing';
import { AgentService } from './agent.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotFoundException } from '@nestjs/common';

describe('AgentService (Multi-Agent Isolation)', () => {
  let service: AgentService;
  let prismaService: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AgentService,
        {
          provide: PrismaService,
          useValue: {
            runInTenantContext: jest.fn((tenantId, cb) => {
              // Mock do transaction (tx)
              return cb({
                agent: {
                  findMany: jest.fn(),
                  findUnique: jest.fn(),
                  create: jest.fn(),
                  update: jest.fn(),
                },
                agentExample: {
                  findMany: jest.fn(),
                  create: jest.fn(),
                  findUnique: jest.fn(),
                  delete: jest.fn(),
                },
              });
            }),
          },
        },
      ],
    }).compile();

    service = module.get<AgentService>(AgentService);
    prismaService = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('addExample', () => {
    it('should throw NotFoundException se tentar adicionar exemplo a um agente inexistente ou de outro tenant', async () => {
      jest.spyOn(prismaService, 'runInTenantContext').mockImplementationOnce(async (tenantId, cb) => {
        return cb({
          agent: {
            findUnique: jest.fn().mockResolvedValue(null),
          },
        } as any);
      });

      await expect(
        service.addExample('tenant-1', 'agent-id-1', { userQuery: 'Q', expectedResponse: 'R' })
      ).rejects.toThrow(NotFoundException);
    });

    it('should create an example using the specific agent id', async () => {
      const mockTx = {
        agent: {
          findUnique: jest.fn().mockResolvedValue({ id: 'agent-1', tenantId: 'tenant-1' }),
        },
        agentExample: {
          create: jest.fn().mockResolvedValue({ id: 'example-1' }),
        },
      };

      jest.spyOn(prismaService, 'runInTenantContext').mockImplementationOnce(async (tenantId, cb) => {
        return cb(mockTx as any);
      });

      const result = await service.addExample('tenant-1', 'agent-1', { userQuery: 'Q', expectedResponse: 'R' });

      expect(result).toEqual({ id: 'example-1' });
      expect(mockTx.agentExample.create).toHaveBeenCalledWith({
        data: {
          tenantId: 'tenant-1',
          agentId: 'agent-1',
          userQuery: 'Q',
          expectedResponse: 'R',
        },
      });
    });
  });

  describe('deleteExample', () => {
    it('should throw NotFoundException if example does not exist or tenant mismatch', async () => {
      const mockTx = {
        agentExample: {
          findUnique: jest.fn().mockResolvedValue({ id: 'example-1', tenantId: 'tenant-2' }), // Tenant diferente
        },
      };

      jest.spyOn(prismaService, 'runInTenantContext').mockImplementationOnce(async (tenantId, cb) => {
        return cb(mockTx as any);
      });

      await expect(
        service.deleteExample('tenant-1', 'agent-1', 'example-1')
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException if example belongs to another agent', async () => {
      const mockTx = {
        agentExample: {
          findUnique: jest.fn().mockResolvedValue({ id: 'example-1', tenantId: 'tenant-1', agentId: 'agent-2' }), // Agente diferente
        },
      };

      jest.spyOn(prismaService, 'runInTenantContext').mockImplementationOnce(async (tenantId, cb) => {
        return cb(mockTx as any);
      });

      await expect(
        service.deleteExample('tenant-1', 'agent-1', 'example-1')
      ).rejects.toThrow(NotFoundException);
    });

    it('should delete example if tenant and agent match', async () => {
      const mockTx = {
        agentExample: {
          findUnique: jest.fn().mockResolvedValue({ id: 'example-1', tenantId: 'tenant-1', agentId: 'agent-1' }),
          delete: jest.fn().mockResolvedValue({ id: 'example-1' }),
        },
      };

      jest.spyOn(prismaService, 'runInTenantContext').mockImplementationOnce(async (tenantId, cb) => {
        return cb(mockTx as any);
      });

      const result = await service.deleteExample('tenant-1', 'agent-1', 'example-1');

      expect(mockTx.agentExample.delete).toHaveBeenCalledWith({
        where: { id: 'example-1' },
      });
      expect(result).toEqual({ id: 'example-1' });
    });
  });
});
