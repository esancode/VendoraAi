import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { Queue, Job } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { ConversationStatus, MessageSender } from '@prisma/client';
import { EncryptionService } from '../security/encryption.service';
import { SanitizerService } from '../security/sanitizer.service';
import { SlaService } from '../sla/sla.service';

@Processor('whatsapp-ingestion')
export class WhatsappIngestionProcessor extends WorkerHost {
  constructor(
    private readonly prisma: PrismaService,
    private readonly encryptionService: EncryptionService,
    private readonly sanitizerService: SanitizerService,
    private readonly slaService: SlaService,
    @InjectQueue('intelligence-pipeline') private readonly intelligenceQueue: Queue,
    @InjectQueue('customer-notification') private readonly notificationQueue: Queue,
  ) {
    super();
  }

  async process(job: Job<any, any, string>): Promise<void> {
    const payload = job.data;
    
    // We already checked this in the controller, but adding safeties
    const entry = payload.entry[0];
    const changes = entry.changes[0];
    const value = changes.value;
    
    const contact = value.contacts && value.contacts[0];
    const message = value.messages[0];
    
    const wamid = message.id;
    const fromPhone = message.from;
    const contactName = contact ? contact.profile.name : 'Unknown';
    const textContent = message.text ? message.text.body : '';
    const timestamp = message.timestamp ? new Date(parseInt(message.timestamp) * 1000) : new Date();

    const metadata = value.metadata;
    const phoneNumberId = metadata?.phone_number_id;

    if (!phoneNumberId) {
      throw new Error('No phone_number_id found in webhook payload. Cannot route message.');
    }

    // 1. Mapeamento de Tenant via WhatsApp Channel
    const channel = await this.prisma.whatsAppChannel.findUnique({
      where: { id: phoneNumberId },
    });

    if (!channel) {
      throw new Error(`WhatsApp Channel not registered for phone_number_id ${phoneNumberId}.`);
    }

    const tenantId = channel.tenantId;
    const agentId = channel.agentId;

    // 2. Segurança de Dados Pessoais (Encryption)
    // Criptografia determinística para o telefone (usado em buscas/upsert)
    const encryptedPhone = this.encryptionService.encryptDeterministic(fromPhone);
    // Criptografia comum para o nome
    const encryptedName = this.encryptionService.encrypt(contactName);

    // 3. Sanitização de Mensagem
    const maskedContent = await this.sanitizerService.sanitize(textContent, tenantId, wamid);

    // Calculate SLA (assume 30 minutes default for now)
    const slaDurationMinutes = 30;
    const slaLimitAt = this.slaService.calculateSlaLimit(timestamp, slaDurationMinutes);

    // 4. Manipulação do Lead & Conversa & Mensagem usando RLS
    const result = await this.prisma.runInTenantContext(tenantId, async (tx) => {
      // Upsert Lead com dados criptografados
      const lead = await tx.lead.upsert({
        where: {
          tenantId_phone: {
            tenantId,
            phone: encryptedPhone,
          },
        },
        create: {
          tenantId,
          phone: encryptedPhone,
          name: encryptedName,
          lastInteractionAt: timestamp,
          slaLimitAt,
        },
        update: {
          name: encryptedName, // Atualiza nome caso tenha mudado
          lastInteractionAt: timestamp,
          slaLimitAt,
        },
      });

      // Find Open Conversation
      let conversation = await tx.conversation.findFirst({
        where: {
          tenantId,
          leadId: lead.id,
          status: ConversationStatus.OPEN,
        },
      });

      // Create new if none exists
      if (!conversation) {
        conversation = await tx.conversation.create({
          data: {
            tenantId,
            leadId: lead.id,
            agentId, // <-- Adicionando o agentId do canal
            status: ConversationStatus.OPEN,
          },
        });
      }

      // Persist Message com dados brutos e sanitizados
      const savedMessage = await tx.message.create({
        data: {
          tenantId,
          conversationId: conversation.id,
          sender: MessageSender.CUSTOMER,
          rawContent: textContent,
          maskedContent: maskedContent, 
          createdAt: timestamp,
        },
      });

      return { leadId: lead.id, messageId: savedMessage.id };
    });

    // 5. Disparo do Pipeline de Inteligência Artificial
    if (agentId) {
      await this.intelligenceQueue.add('analyze-conversation', {
        tenantId,
        leadId: result.leadId,
        messageId: result.messageId,
        agentId,
      });
    } else {
      // Caso não haja agente, o bot não age e podemos colocar o Lead em estado de atenção humana
      await this.prisma.runInTenantContext(tenantId, async (tx) => {
        await tx.lead.update({
          where: { id: result.leadId },
          data: { needsHumanReview: true, status: 'MANUAL_INTERVENTION_REQUIRED' },
        });
      });
    }

    // 6. Agendamento de SLA (Delayed Jobs)
    const now = new Date();
    const totalSlaMsRemaining = Math.max(0, slaLimitAt.getTime() - now.getTime());
    const warningSlaMsRemaining = Math.max(0, totalSlaMsRemaining * 0.8);

    await this.notificationQueue.add('lead.sla_warning', {
      tenantId,
      leadId: result.leadId,
    }, {
      jobId: `sla-warn-${result.leadId}`,
      delay: warningSlaMsRemaining,
    });

    await this.notificationQueue.add('lead.sla_breached', {
      tenantId,
      leadId: result.leadId,
    }, {
      jobId: `sla-breach-${result.leadId}`,
      delay: totalSlaMsRemaining,
    });
  }
}
