import { Controller, Get, UseGuards, Req, Query } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PrismaService } from '../prisma/prisma.service';
import type { FastifyRequest } from 'fastify';

@Controller('api/v1/leads')
@UseGuards(JwtAuthGuard)
export class LeadsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('priority')
  async getPriorityLeads(@Req() req: FastifyRequest, @Query('agentId') agentId?: string) {
    const tenantId = req.tenantContext!.tenantId;

    const leads = await this.prisma.lead.findMany({
      where: {
        tenantId,
        status: 'ACTIVE',
        ...(agentId ? {
          conversations: {
            some: {
              status: 'OPEN',
              agentId: agentId,
            }
          }
        } : {})
      },
      orderBy: {
        slaLimitAt: 'asc',
      },
      take: 5,
    });

    return leads.map(lead => ({
      id: lead.id,
      name: lead.name,
      status: lead.status,
      createdAt: lead.createdAt,
      slaLimitAt: lead.slaLimitAt,
      lastMessage: lead.conversationalSummary || 'Nenhuma conversa registrada ainda.',
    }));
  }
}
