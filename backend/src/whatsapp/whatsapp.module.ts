import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { WhatsappOutboundProcessor } from './whatsapp-outbound.processor';
import { PrismaModule } from '../prisma/prisma.module';
import { WhatsAppChannelsController } from './whatsapp-channels.controller';
import { WhatsAppChannelsService } from './whatsapp-channels.service';
import { WhatsappQrCodeService } from './whatsapp-qrcode.service';
import { AuthModule } from '../auth/auth.module';
import { SecurityModule } from '../security/security.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    SecurityModule,
    NotificationsModule,
    BullModule.registerQueue({
      name: 'whatsapp-ingestion',
    }),
  ],
  controllers: [WhatsAppChannelsController],
  providers: [WhatsappOutboundProcessor, WhatsAppChannelsService, WhatsappQrCodeService],
})
export class WhatsappModule {}
