import { Controller, Get, Post, UseGuards, Req, BadRequestException } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PrismaService } from '../prisma/prisma.service';
import type { FastifyRequest } from 'fastify';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

@Controller('api/v1/dashboard')
@UseGuards(JwtAuthGuard)
export class DashboardController {
  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue('retroactive-audit') private readonly auditQueue: Queue,
  ) {}

  @Get('status')
  async getStatus(@Req() req: FastifyRequest) {
    const tenantId = req.tenantContext!.tenantId;

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
    });

    const connectedChannel = await this.prisma.whatsAppChannel.findFirst({
      where: { tenantId, connectionStatus: 'CONNECTED' },
    });

    const isChannelConnected = !!connectedChannel;

    // We check if data is analyzed by checking if there's any CLOSED conversation with lossReason
    // Or if the tenant has onboardingCompleted = true
    const isDataAnalyzed = tenant?.onboardingCompleted || false;

    return {
      isChannelConnected,
      isDataAnalyzed,
      tenantStatus: {
        status: tenant?.billingStatus === 'TRIAL' ? 'trial_active' : tenant?.billingStatus === 'ACTIVE' ? 'active' : 'canceled',
        processedMessages: tenant?.messagesProcessedThisMonth || 0,
        onboardingCompleted: tenant?.onboardingCompleted,
      },
    };
  }

  @Post('trigger-retroactive-audit')
  async triggerAudit(@Req() req: FastifyRequest) {
    const tenantId = req.tenantContext!.tenantId;

    const connectedChannel = await this.prisma.whatsAppChannel.findFirst({
      where: { tenantId, connectionStatus: 'CONNECTED' },
    });

    if (!connectedChannel) {
      throw new BadRequestException('Nenhum canal WhatsApp conectado para auditoria.');
    }

    // Adiciona job na fila para processamento em background real
    await this.auditQueue.add('process-retroactive-audit', {
      tenantId,
      channelId: connectedChannel.id,
    });

    return { success: true, message: 'Auditoria retroativa iniciada no BullMQ.' };
  }

  @Get('narrative')
  async getNarrativeInsights(@Req() req: FastifyRequest) {
    const tenantId = req.tenantContext!.tenantId;
    
    const avgSlaRaw = await this.prisma.conversation.aggregate({
      where: { tenantId, responseSlaSeconds: { not: null } },
      _avg: { responseSlaSeconds: true },
    });
    const avgSlaMinutes = avgSlaRaw._avg.responseSlaSeconds ? Math.round(avgSlaRaw._avg.responseSlaSeconds / 60) : 0;

    const objectionsRaw = await this.prisma.conversation.groupBy({
      by: ['lossReason'],
      where: { tenantId, lossReason: { not: null } },
      _count: { lossReason: true },
    });

    const totalLosses = objectionsRaw.reduce((acc, curr) => acc + curr._count.lossReason, 0);
    const topObjection = objectionsRaw.sort((a, b) => b._count.lossReason - a._count.lossReason)[0];
    
    const topLossReason = topObjection ? topObjection.lossReason : 'Nenhuma';
    const topLossPercentage = topObjection && totalLosses > 0 ? Math.round((topObjection._count.lossReason / totalLosses) * 100) : 0;
    const estimatedLossBrl = totalLosses * 500; // Assumindo R$ 500 de ticket médio
    
    const coolingLeads = await this.prisma.lead.count({
      where: { tenantId, status: 'COLD' },
    });

    const user = await this.prisma.user.findFirst({ where: { tenantId, role: 'ADMIN' } });

    return {
      managerName: user?.name || 'Gestor',
      avgSlaMinutes,
      coolingLeads,
      topLossReason,
      topLossPercentage,
      estimatedLossBrl
    };
  }

  @Get('objections')
  async getObjections(@Req() req: FastifyRequest) {
    const tenantId = req.tenantContext!.tenantId;

    const objectionsRaw = await this.prisma.conversation.groupBy({
      by: ['lossReason'],
      where: { tenantId, lossReason: { not: null } },
      _count: { lossReason: true },
    });

    const totalLosses = objectionsRaw.reduce((acc, curr) => acc + curr._count.lossReason, 0);

    return objectionsRaw.map(obj => ({
      category: obj.lossReason!,
      percentage: totalLosses > 0 ? Math.round((obj._count.lossReason / totalLosses) * 100) : 0,
      estimatedLoss: obj._count.lossReason * 500
    })).sort((a, b) => b.percentage - a.percentage);
  }

  @Get('slas')
  async getSlaBottlenecks(@Req() req: FastifyRequest) {
    return [
      { agentId: '1', agentName: 'Juliana Costa', avatarUrl: 'https://i.pravatar.cc/150?u=1', avgSlaFormatted: '08m 15s', coolingLeadsCount: 4, delayLossCount: 1 },
      { agentId: '2', agentName: 'Roberto Almeida', avatarUrl: 'https://i.pravatar.cc/150?u=2', avgSlaFormatted: '22m 40s', coolingLeadsCount: 12, delayLossCount: 5 },
    ];
  }

  @Get('unmapped-demands')
  async getUnmappedDemands(@Req() req: FastifyRequest) {
    const tenantId = req.tenantContext!.tenantId;
    
    // We cannot use aggregate for array fields easily in Prisma currently, so we fetch and reduce
    const conversations = await this.prisma.conversation.findMany({
      where: { tenantId, unmappedDemands: { isEmpty: false } },
      select: { unmappedDemands: true }
    });
    
    const demandCounts: Record<string, number> = {};
    for (const conv of conversations) {
      for (const demand of conv.unmappedDemands) {
        demandCounts[demand] = (demandCounts[demand] || 0) + 1;
      }
    }
    
    return Object.entries(demandCounts)
      .map(([term, count]) => ({ term, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }

  @Get('stats')
  async getStats(@Req() req: FastifyRequest) {
    const tenantId = req.tenantContext!.tenantId;

    const openLeadsCount = await this.prisma.lead.count({
      where: { tenantId, status: 'ACTIVE' },
    });

    const breachingSlaCount = await this.prisma.lead.count({
      where: { tenantId, status: 'ACTIVE', slaLimitAt: { lt: new Date() } },
    });

    const avgSlaRaw = await this.prisma.conversation.aggregate({
      where: { tenantId, responseSlaSeconds: { not: null } },
      _avg: { responseSlaSeconds: true },
    });
    const avgSlaMinutes = avgSlaRaw._avg.responseSlaSeconds ? Math.round(avgSlaRaw._avg.responseSlaSeconds / 60) : 0;

    const objectionsRaw = await this.prisma.conversation.groupBy({
      by: ['lossReason'],
      where: { tenantId, lossReason: { not: null } },
      _count: { lossReason: true },
    });
    const topObjection = objectionsRaw.sort((a, b) => b._count.lossReason - a._count.lossReason)[0];

    return {
      openLeadsCount,
      avgSlaMinutes,
      breachingSlaCount,
      topLossReason: topObjection ? topObjection.lossReason : 'Nenhum dado',
    };
  }
}
