import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SlaService } from '../sla/sla.service';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { MessageSender } from '@prisma/client';

@Injectable()
export class AgentReplyService {
  private readonly logger = new Logger(AgentReplyService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly slaService: SlaService,
    @InjectQueue('customer-notification') private readonly notificationQueue: Queue,
  ) {}

  async handleAgentReply(tenantId: string, leadId: string, content: string, agentId?: string) {
    this.logger.log(`Handling agent reply for lead ${leadId}`);

    return await this.prisma.runInTenantContext(tenantId, async (tx) => {
      const lead = await tx.lead.findUnique({
        where: { id: leadId },
        include: {
          conversations: {
            where: { status: 'OPEN' },
            include: {
              messages: {
                where: { sender: MessageSender.CUSTOMER },
                orderBy: { createdAt: 'desc' },
                take: 1,
              },
            },
          },
        },
      });

      if (!lead) {
        throw new NotFoundException('Lead not found');
      }

      const conversation = lead.conversations[0];
      if (!conversation) {
        throw new NotFoundException('No open conversation found for this lead');
      }

      const lastCustomerMessage = conversation.messages[0];
      const now = new Date();
      let responseTimeInSeconds: number | null = null;

      if (lastCustomerMessage) {
        responseTimeInSeconds = this.slaService.calculateUsefulResponseTime(lastCustomerMessage.createdAt, now);
      }

      // Update Lead: Clear SLA limit
      await tx.lead.update({
        where: { id: leadId },
        data: {
          slaLimitAt: null,
          lastInteractionAt: now,
        },
      });

      // Update Conversation: accumulate SLA response seconds
      await tx.conversation.update({
        where: { id: conversation.id },
        data: {
          responseSlaSeconds: {
            increment: responseTimeInSeconds || 0,
          },
        },
      });

      // Persist agent message
      const agentMessage = await tx.message.create({
        data: {
          tenantId,
          conversationId: conversation.id,
          sender: MessageSender.AGENT,
          rawContent: content,
          maskedContent: content, // Typically agents don't send PII that needs masking for their own dashboard, or we use sanitizer later
          createdAt: now,
          responseTime: responseTimeInSeconds,
        },
      });

      // Cancel SLA Delayed Jobs on BullMQ
      // We look up the jobs by their predefined custom IDs
      try {
        const warnJobId = `sla-warn-${leadId}`;
        const breachJobId = `sla-breach-${leadId}`;

        // Attempt to remove jobs if they exist and are delayed
        await this.notificationQueue.remove(warnJobId);
        await this.notificationQueue.remove(breachJobId);
        
        this.logger.log(`Cancelled SLA delay jobs for lead ${leadId}`);
      } catch (error) {
        this.logger.warn(`Failed to remove SLA jobs for lead ${leadId}: ${error.message}`);
      }

      return agentMessage;
    });
  }
}
