import { Injectable, CanActivate, ExecutionContext, ForbiddenException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { FastifyRequest } from 'fastify';

@Injectable()
export class BillingGuard implements CanActivate {
  private readonly logger = new Logger(BillingGuard.name);

  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const tenantId = request.tenantContext?.tenantId;

    if (!tenantId) {
      return true; // Pula se não houver contexto de tenant
    }

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        plan: true,
        billingStatus: true,
        trialEndsAt: true,
        messagesProcessedThisMonth: true,
        aiDraftsProcessedThisMonth: true,
        customGeminiApiKey: true,
        customOpenAiApiKey: true,
      }
    });

    if (!tenant) return true;

    let { billingStatus } = tenant;

    // Trial Expiration Check
    if (billingStatus === 'TRIAL' && tenant.trialEndsAt && new Date() > tenant.trialEndsAt) {
      await this.prisma.tenant.update({
        where: { id: tenantId },
        data: { billingStatus: 'SUSPENDED' },
      });
      billingStatus = 'SUSPENDED';
    }

    // 3. Bloqueio por Inadimplência ou Trial Expirado
    if (billingStatus === 'SUSPENDED') {
      const msg = tenant.plan === 'STARTER' 
        ? 'Seu período de teste gratuito de 7 dias expirou. Faça o upgrade para continuar.'
        : 'Acesso bloqueado: Sua assinatura está suspensa.';

      throw new ForbiddenException({
        code: 'SUBSCRIPTION_SUSPENDED',
        message: msg
      });
    }

    const isStarter = tenant.plan === 'STARTER';
    const isGrowth = tenant.plan === 'GROWTH';

    const url = request.url;
    const method = request.method;

    const hasByok = !!tenant.customGeminiApiKey || !!tenant.customOpenAiApiKey;

    // 0. Validação de Limites do Teste Gratuito
    if (billingStatus === 'TRIAL' && !hasByok) {
      if (tenant.messagesProcessedThisMonth >= 1000 || tenant.aiDraftsProcessedThisMonth >= 30) {
        if (['POST', 'PUT', 'PATCH'].includes(method) && !url.includes('/billing/')) {
          throw new ForbiddenException('Limite de consumo do teste gratuito atingido. Cadastre uma chave própria de IA (BYOK) ou assine um plano para liberar acesso ilimitado.');
        }
      }
    }

    // 1. Bloqueio de Usuários (Seats)
    // Supondo que a criação de usuário seja POST /api/v1/users ou /api/v1/tenant/users
    if (method === 'POST' && url.includes('/users')) {
      const usersCount = await this.prisma.user.count({ where: { tenantId } });
      
      if (isStarter && usersCount >= 3) {
        throw new ForbiddenException('Limite de usuários (3) excedido no plano STARTER.');
      }
      if (isGrowth && usersCount >= 10) {
        throw new ForbiddenException('Limite de usuários (10) excedido no plano GROWTH.');
      }
    }

    // 2. Bloqueio de RAG/Rascunhos
    // Rota POST /api/v1/chats/:id/draft
    if (method === 'POST' && url.match(/\/chats\/[^/]+\/draft/)) {
      if (isStarter && billingStatus !== 'TRIAL') {
        throw new ForbiddenException('Recurso Indisponível: O plano STARTER não possui acesso à geração de rascunhos com IA.');
      }
      
      // Verifica limite de uso
      // Se for BYOK, não bloqueia
      if (!hasByok) {
        // Limite de rascunhos
        const draftsQuota = isStarter ? 1500 : isGrowth ? 5000 : 999999;
        
        if (tenant.aiDraftsProcessedThisMonth >= draftsQuota) {
           throw new ForbiddenException('Limite de rascunhos de IA mensal excedido. Configure sua própria chave (BYOK) ou faça upgrade do plano.');
        }
      }
    }

    // 4. Bloqueio por Limite de Mensagens para outras rotas pode ser tratado nos Services/Webhooks
    // pois se bloquearmos no guard, o webhook do Whatsapp falharia e o cliente não receberia as mensagens.
    // Para endpoints normais, permitiremos passar e o pipeline de inteligência ignorará a IA.

    return true;
  }
}
