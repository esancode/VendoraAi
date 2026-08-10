import { Injectable, Logger, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SaasPlan } from '@prisma/client';

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);
  private readonly asaasApiUrl = process.env.ASAAS_API_URL || 'https://sandbox.asaas.com/api/v3';
  private readonly asaasApiKey = process.env.ASAAS_API_KEY;

  constructor(private readonly prisma: PrismaService) {}

  async createCheckoutLink(tenantId: string, plan: SaasPlan) {
    if (!this.asaasApiKey) {
      this.logger.warn('ASAAS_API_KEY não configurada. Simulando link de pagamento para ambiente de dev.');
      return {
        paymentLinkUrl: `https://sandbox.asaas.com/paymentLink/simulation?plan=${plan}&tenantId=${tenantId}`
      };
    }

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      include: { users: { where: { role: 'ADMIN' }, take: 1 } }
    });

    if (!tenant) throw new InternalServerErrorException('Tenant não encontrado');

    const admin = tenant.users[0];
    let price = 0;
    
    if (plan === 'GROWTH') price = 299.00;
    else if (plan === 'ENTERPRISE') price = 999.00;
    else price = 0;

    // Em uma implementação real completa, faríamos:
    // 1. Criar/buscar Cliente no Asaas
    // 2. Criar a Assinatura (Subscription)
    // Para simplificar a experiência "sem burocracia" do link de pagamento com cartão, usamos a rota de paymentLinks
    
    try {
      const response = await fetch(`${this.asaasApiUrl}/paymentLinks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'access_token': this.asaasApiKey
        },
        body: JSON.stringify({
          name: `Assinatura VendoraAI - Plano ${plan}`,
          value: price,
          chargeType: 'RECURRENT',
          subscriptionCycle: 'MONTHLY',
          billingType: 'UNDEFINED'
        })
      });

      const data = await response.json();

      if (!response.ok) {
        this.logger.error(`Erro ao criar link de pagamento no Asaas: ${JSON.stringify(data)}`);
        throw new InternalServerErrorException('Erro ao se comunicar com gateway de pagamento');
      }

      return {
        paymentLinkUrl: data.url
      };
    } catch (error) {
      this.logger.error(`Exceção ao criar link Asaas: ${error}`);
      throw new InternalServerErrorException('Erro interno ao gerar checkout');
    }
  }
}
