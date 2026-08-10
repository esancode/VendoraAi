import { Test, TestingModule } from '@nestjs/testing';
import { AgentService } from '../src/agent/agent.service';
import { PrismaService } from '../src/prisma/prisma.service';
import * as crypto from 'crypto';

describe('AgentService Integration with RLS', () => {
  let agentService: AgentService;
  let prisma: PrismaService;
  let tenant1Id: string;
  let tenant2Id: string;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AgentService, PrismaService],
    }).compile();

    agentService = module.get<AgentService>(AgentService);
    prisma = module.get<PrismaService>(PrismaService);

    // Setup Test Tenants
    tenant1Id = crypto.randomUUID();
    tenant2Id = crypto.randomUUID();

    await prisma.tenant.createMany({
      data: [
        { id: tenant1Id, name: 'Tenant Alpha' },
        { id: tenant2Id, name: 'Tenant Beta' },
      ],
    });
  });

  afterAll(async () => {
    // Cleanup
    await prisma.tenant.deleteMany({
      where: { id: { in: [tenant1Id, tenant2Id] } },
    });
    await prisma.$disconnect();
  });

  it('should create and retrieve an agent isolated by tenant (RLS)', async () => {
    // Upsert Agent for Tenant 1
    const agent1 = await agentService.upsertAgent(tenant1Id, {
      name: 'Agent Alpha',
      basePrompt: 'Alpha rules',
      onboardingAnswers: { style: 'formal' },
    });

    expect(agent1.tenantId).toBe(tenant1Id);
    expect(agent1.name).toBe('Agent Alpha');

    // Tenant 2 attempts to read their agent (should be null)
    const emptyAgent = await agentService.getAgent(tenant2Id);
    expect(emptyAgent).toBeNull();

    // Tenant 2 attempts to list examples (should be empty array)
    const emptyExamples = await agentService.listExamples(tenant2Id);
    expect(emptyExamples).toEqual([]);
  });

  it('should isolate AgentExamples using RLS', async () => {
    // Upsert Agent for Tenant 2 to allow adding examples
    await agentService.upsertAgent(tenant2Id, {
      name: 'Agent Beta',
      basePrompt: 'Beta rules',
      onboardingAnswers: { style: 'informal' },
    });

    // Add example for Tenant 2
    const exampleBeta = await agentService.addExample(tenant2Id, {
      userQuery: 'Ola',
      expectedResponse: 'E ai chapa!',
    });

    expect(exampleBeta.tenantId).toBe(tenant2Id);
    expect(exampleBeta.expectedResponse).toBe('E ai chapa!');

    // Tenant 1 lists examples, should not see Beta's example
    const alphaExamples = await agentService.listExamples(tenant1Id);
    expect(alphaExamples).toHaveLength(0);

    // Tenant 1 attempts to delete Beta's example
    await expect(agentService.deleteExample(tenant1Id, exampleBeta.id)).rejects.toThrow();

    // Delete normally as Tenant 2
    await agentService.deleteExample(tenant2Id, exampleBeta.id);
    const betaExamplesAfterDelete = await agentService.listExamples(tenant2Id);
    expect(betaExamplesAfterDelete).toHaveLength(0);
  });
});
