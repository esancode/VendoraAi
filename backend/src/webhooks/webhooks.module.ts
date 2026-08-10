import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { WhatsappController } from './whatsapp.controller';
import { IdempotencyService } from './idempotency.service';
import { WhatsappIngestionProcessor } from './whatsapp-ingestion.processor';
import { SecurityModule } from '../security/security.module';
import { SlaModule } from '../sla/sla.module';

@Module({
  imports: [
    BullModule.registerQueue(
      {
        name: 'whatsapp-ingestion',
        defaultJobOptions: {
          attempts: 5,
          backoff: {
            type: 'exponential',
            delay: 500,
          },
        },
      },
      {
        name: 'intelligence-pipeline',
        defaultJobOptions: {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 1000,
          },
        },
      },
      {
        name: 'customer-notification',
      }
    ),
    SecurityModule,
    SlaModule,
  ],
  controllers: [WhatsappController],
  providers: [IdempotencyService, WhatsappIngestionProcessor],
})
export class WebhooksModule {}
