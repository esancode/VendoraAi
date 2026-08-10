import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { NotificationGateway } from './notification.gateway';
import { CustomerNotificationProcessor } from './customer-notification.processor';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [
    JwtModule.register({}),
    PrismaModule,
  ],
  providers: [NotificationGateway, CustomerNotificationProcessor],
  exports: [NotificationGateway],
})
export class NotificationsModule {}
