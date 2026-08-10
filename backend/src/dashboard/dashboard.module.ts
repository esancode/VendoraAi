import { Module } from '@nestjs/common';
import { DashboardController } from './dashboard.controller';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { BullModule } from '@nestjs/bullmq';
import { RetroactiveAuditProcessor } from './retroactive-audit.processor';
import { IntelligenceModule } from '../intelligence/intelligence.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    AuthModule, 
    PrismaModule,
    IntelligenceModule,
    NotificationsModule,
    BullModule.registerQueue({
      name: 'retroactive-audit',
    }),
  ],
  controllers: [DashboardController],
  providers: [RetroactiveAuditProcessor],
})
export class DashboardModule {}
