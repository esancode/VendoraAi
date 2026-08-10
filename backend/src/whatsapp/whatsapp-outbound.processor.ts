import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { LeadStatus, MessageSender } from '@prisma/client';

export interface WhatsappOutboundPayload {
  tenantId: string;
  leadId: string;
  conversationId: string;
  content: string;
}

@Processor('whatsapp-outbound')
export class WhatsappOutboundProcessor extends WorkerHost {
  private readonly logger = new Logger(WhatsappOutboundProcessor.name);

  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async process(job: Job<WhatsappOutboundPayload, any, string>): Promise<void> {
    const { tenantId, leadId, conversationId, content } = job.data;
    this.logger.log(`Processando disparo agendado para Lead: ${leadId}`);

    await this.prisma.runInTenantContext(tenantId, async (tx) => {
      // Verifica se o lead ainda está no fluxo automatizado (sem intervenção humana no meio do delay)
      const lead = await tx.lead.findUnique({ where: { id: leadId } });
      
      if (!lead) {
        this.logger.warn(`Lead ${leadId} não encontrado. Abortando envio.`);
        return;
      }

      if (lead.status === LeadStatus.MANUAL_INTERVENTION_REQUIRED) {
        this.logger.warn(`Envio abortado: Lead ${leadId} entrou em intervenção manual durante o delay.`);
        return;
      }

      // Simulação do disparo final da API de WhatsApp
      this.logger.log(`[WHATSAPP-API-MOCK] Enviando mensagem final: "${content}"`);

      // Salva a mensagem como originada do sistema (AI)
      await tx.message.create({
        data: {
          conversationId,
          tenantId,
          sender: MessageSender.SYSTEM,
          rawContent: content,
          maskedContent: content, // Em ambiente real passaria pelo mask novamente
        },
      });

      this.logger.log(`Mensagem autônoma despachada e registrada com sucesso.`);
    });
  }
}
