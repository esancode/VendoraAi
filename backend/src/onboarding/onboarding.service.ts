import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { KnowledgeService } from '../intelligence/knowledge.service';

@Injectable()
export class OnboardingService {
  private readonly logger = new Logger(OnboardingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly knowledgeService: KnowledgeService,
  ) {}

  async processOnboardingData(tenantId: string, userId: string, data: any) {
    const { niche, businessHours, shippingRules, paymentMethods, faqs } = data;
    
    // Create or update default agent
    let agent = await this.prisma.agent.findFirst({ where: { tenantId } });
    if (!agent) {
      agent = await this.prisma.agent.create({
        data: {
          tenantId,
          name: `Agente Comercial - ${niche || 'Geral'}`,
          onboardingAnswers: data,
          basePrompt: `Você é um agente comercial para o nicho de ${niche}. Responda de forma profissional e direta.`,
        }
      });
    } else {
      await this.prisma.agent.update({
        where: { id: agent.id },
        data: { onboardingAnswers: data }
      });
    }

    // Save Knowledge Source via KnowledgeService
    const combinedContent = `
Horário Comercial: ${JSON.stringify(businessHours)}
Políticas de Envio e Frete: ${shippingRules}
Formas de Pagamento: ${paymentMethods}
FAQs: ${JSON.stringify(faqs)}
`;

    await this.knowledgeService.createSource(
      tenantId, 
      agent.id, 
      'Regras de Negócio Iniciais (Onboarding)', 
      combinedContent
    );

    // Mark onboarding as completed
    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: { onboardingCompleted: true }
    });

    return { success: true, message: 'Onboarding completed and knowledge vectorised.' };
  }
}
