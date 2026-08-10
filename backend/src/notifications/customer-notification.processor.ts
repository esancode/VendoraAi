import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationGateway } from './notification.gateway';

@Processor('customer-notification')
export class CustomerNotificationProcessor extends WorkerHost {
  private readonly logger = new Logger(CustomerNotificationProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationGateway: NotificationGateway,
  ) {
    super();
  }

  async process(job: Job<any, any, string>): Promise<void> {
    const { leadId, tenantId, type } = job.data;
    
    this.logger.log(`Processing SLA Job: ${job.name} for Lead: ${leadId}`);

    // Verify if lead still has SLA limit active
    const lead = await this.prisma.lead.findUnique({
      where: { id: leadId },
    });

    if (!lead) {
      this.logger.warn(`Lead ${leadId} not found, ignoring SLA job`);
      return;
    }

    if (!lead.slaLimitAt) {
      this.logger.log(`Lead ${leadId} already answered, discarding SLA job ${job.name}`);
      return; // Agent already replied, ignoring
    }

    // Agent hasn't replied yet, send real-time warning
    if (job.name === 'lead.sla_warning') {
      this.notificationGateway.broadcastToTenant(tenantId, 'lead.sla_warning', {
        leadId,
        message: 'SLA Warning: 80% of SLA time elapsed!',
        slaLimitAt: lead.slaLimitAt,
      });
    } else if (job.name === 'lead.sla_breached') {
      this.notificationGateway.broadcastToTenant(tenantId, 'lead.sla_breached', {
        leadId,
        message: 'SLA Breached: 100% of SLA time elapsed!',
        slaLimitAt: lead.slaLimitAt,
      });
    }
  }
}
