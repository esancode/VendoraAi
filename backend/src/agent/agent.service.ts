import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AgentService {
  constructor(private readonly prisma: PrismaService) {}

  async listAgents(tenantId: string) {
    return await this.prisma.runInTenantContext(tenantId, async (tx) => {
      const agents = await tx.agent.findMany({
        orderBy: { createdAt: 'desc' },
      });
      return agents.map(agent => {
        const answers = agent.onboardingAnswers as any || {};
        return {
          ...agent,
          tone: answers.tone,
          maxDiscount: answers.maxDiscount,
          refundPolicy: answers.refundPolicy,
          useEmojis: answers.useEmojis,
        };
      });
    });
  }

  async getAgent(tenantId: string, agentId: string) {
    return await this.prisma.runInTenantContext(tenantId, async (tx) => {
      const agent = await tx.agent.findUnique({
        where: { id: agentId },
      });
      if (!agent) throw new NotFoundException('Agente não encontrado');
      
      const answers = agent.onboardingAnswers as any || {};
      return {
        ...agent,
        tone: answers.tone,
        maxDiscount: answers.maxDiscount,
        refundPolicy: answers.refundPolicy,
        useEmojis: answers.useEmojis,
      };
    });
  }

  async createAgent(tenantId: string, data: any) {
    return await this.prisma.runInTenantContext(tenantId, async (tx) => {
      const onboardingAnswers = {
        tone: data.tone,
        maxDiscount: data.maxDiscount,
        refundPolicy: data.refundPolicy,
        useEmojis: data.useEmojis,
      };

      const agent = await tx.agent.create({
        data: {
          tenantId,
          name: data.name || 'Assistente Virtual',
          onboardingAnswers,
          basePrompt: data.basePrompt || null,
          temperature: data.temperature ?? 0.7,
        },
      });
      return agent;
    });
  }

  async updateAgent(tenantId: string, agentId: string, data: any) {
    return await this.prisma.runInTenantContext(tenantId, async (tx) => {
      const agentExists = await tx.agent.findUnique({ where: { id: agentId } });
      if (!agentExists) throw new NotFoundException('Agente não encontrado');

      const onboardingAnswers = {
        tone: data.tone,
        maxDiscount: data.maxDiscount,
        refundPolicy: data.refundPolicy,
        useEmojis: data.useEmojis,
      };

      const agent = await tx.agent.update({
        where: { id: agentId },
        data: {
          name: data.name,
          onboardingAnswers,
          basePrompt: data.basePrompt,
          temperature: data.temperature,
          status: data.status,
        },
      });
      return agent;
    });
  }

  async deleteAgent(tenantId: string, agentId: string) {
    return await this.prisma.runInTenantContext(tenantId, async (tx) => {
      const agentExists = await tx.agent.findUnique({ where: { id: agentId } });
      if (!agentExists) throw new NotFoundException('Agente não encontrado');

      return await tx.agent.delete({
        where: { id: agentId },
      });
    });
  }

  async listExamples(tenantId: string, agentId: string) {
    return await this.prisma.runInTenantContext(tenantId, async (tx) => {
      return await tx.agentExample.findMany({
        where: { agentId },
        orderBy: { createdAt: 'desc' },
      });
    });
  }

  async addExample(tenantId: string, agentId: string, data: { userQuery: string; expectedResponse: string }) {
    return await this.prisma.runInTenantContext(tenantId, async (tx) => {
      const agent = await tx.agent.findUnique({
        where: { id: agentId },
      });
      if (!agent) {
        throw new NotFoundException('Agente não encontrado');
      }

      return await tx.agentExample.create({
        data: {
          tenantId,
          agentId: agent.id,
          userQuery: data.userQuery,
          expectedResponse: data.expectedResponse,
        },
      });
    });
  }

  async deleteExample(tenantId: string, exampleId: string) {
    return await this.prisma.runInTenantContext(tenantId, async (tx) => {
      const example = await tx.agentExample.findUnique({
        where: { id: exampleId },
      });

      if (!example || example.tenantId !== tenantId) {
        throw new NotFoundException('Exemplo não encontrado ou acesso negado');
      }

      return await tx.agentExample.delete({
        where: { id: exampleId },
      });
    });
  }
}
