import { Controller, Post, Get, Headers, Body, Req, UseGuards, UnauthorizedException, Logger, Inject } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { BillingService } from './billing.service';
import type { FastifyRequest } from 'fastify';
import { SaasPlan } from '@prisma/client';

@Controller('api/v1/billing')
export class BillingController {
  private readonly logger = new Logger(BillingController.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly billingService: BillingService
  ) {}

  @Get('status')
  @UseGuards(JwtAuthGuard)
  async getStatus(@Req() req: FastifyRequest) {
    const tenantId = req.tenantContext!.tenantId;
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

    if (!tenant) throw new UnauthorizedException('Tenant not found');

    const daysRemaining = tenant.trialEndsAt ? Math.max(0, Math.ceil((tenant.trialEndsAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24))) : 0;

    const response = {
      plan: tenant.plan,
      billingStatus: tenant.billingStatus,
      trialEndsAt: tenant.trialEndsAt,
      daysRemaining,
      messagesProcessedThisMonth: tenant.messagesProcessedThisMonth,
      aiDraftsProcessedThisMonth: tenant.aiDraftsProcessedThisMonth,
      hasGeminiKey: !!tenant.customGeminiApiKey,
      hasOpenAiKey: !!tenant.customOpenAiApiKey,
    };
    console.log('API /billing/status RETURNING:', response);
    return response;
  }

  @Post('byok')
  @UseGuards(JwtAuthGuard)
  async saveByok(@Req() req: FastifyRequest, @Body() body: { geminiKey?: string, openaiKey?: string }) {
    const tenantId = req.tenantContext!.tenantId;
    
    const data: any = {};
    if (body.geminiKey !== undefined) data.customGeminiApiKey = body.geminiKey || null;
    if (body.openaiKey !== undefined) data.customOpenAiApiKey = body.openaiKey || null;

    await this.prisma.tenant.update({
      where: { id: tenantId },
      data,
    });

    return { success: true };
  }

  @Post('checkout-link')
  @UseGuards(JwtAuthGuard)
  async generateCheckoutLink(@Req() req: FastifyRequest, @Body() body: { plan: string }) {
    const tenantId = req.tenantContext!.tenantId;
    if (!['GROWTH', 'ENTERPRISE'].includes(body.plan)) {
      throw new Error('Plano inválido para checkout online.');
    }
    
    return await this.billingService.createCheckoutLink(tenantId, body.plan as SaasPlan);
  }

  @Post('webhook/asaas')
  async handleAsaasWebhook(
    @Headers('asaas-access-token') asaasToken: string,
    @Body() payload: any
  ) {
    const validToken = process.env.ASAAS_WEBHOOK_TOKEN;
    
    if (!validToken || asaasToken !== validToken) {
      this.logger.warn(`Tentativa de acesso não autorizado ao webhook do Asaas. IP: ignorado`);
      throw new UnauthorizedException('Token de webhook inválido');
    }

    this.logger.log(`Webhook Asaas recebido: Evento ${payload.event}`);

    const customerId = payload.customer;
    if (!customerId) {
      return { success: true };
    }

    const tenant = await this.prisma.tenant.findUnique({
      where: { asaasCustomerId: customerId }
    });

    if (!tenant) {
      this.logger.warn(`Tenant não encontrado para o asaasCustomerId: ${customerId}`);
      return { success: true };
    }

    switch (payload.event) {
      case 'PAYMENT_RECEIVED':
      case 'PAYMENT_CONFIRMED':
        // No asaas a descricao do item comprado via PaymentLink fica em payload.payment.description
        // Precisamos extrair o plano que ele comprou.
        let updatedPlan = tenant.plan;
        const description = payload.payment?.description?.toUpperCase() || '';
        if (description.includes('GROWTH')) updatedPlan = 'GROWTH';
        if (description.includes('ENTERPRISE')) updatedPlan = 'ENTERPRISE';

        await this.prisma.tenant.update({
          where: { id: tenant.id },
          data: {
            billingStatus: 'ACTIVE',
            plan: updatedPlan,
            messagesProcessedThisMonth: 0,
            aiDraftsProcessedThisMonth: 0,
          }
        });
        
        // Registrar a invoice
        if (payload.payment) {
          await this.prisma.billingInvoice.create({
            data: {
              tenantId: tenant.id,
              amount: payload.payment.value || 0,
              status: 'PAID',
              paymentMethod: payload.payment.billingType || 'UNKNOWN',
              invoiceUrl: payload.payment.invoiceUrl,
              dueDate: new Date(payload.payment.dueDate),
              paidAt: new Date(),
            }
          });
        }
        break;

      case 'PAYMENT_OVERDUE':
        await this.prisma.tenant.update({
          where: { id: tenant.id },
          data: {
            billingStatus: 'OVERDUE'
          }
        });
        
        // Em um sistema real, aqui emitiríamos um evento WebSocket (Socket.io) para o frontend
        this.logger.log(`Tenant ${tenant.id} alterado para OVERDUE. Enviar WS evento.`);
        break;

      case 'SUBSCRIPTION_DELETED':
      case 'PAYMENT_REFUNDED':
      case 'PAYMENT_CHARGEBACK_REQUESTED':
        await this.prisma.tenant.update({
          where: { id: tenant.id },
          data: {
            billingStatus: 'SUSPENDED'
          }
        });
        break;
    }

    return { success: true };
  }
}
