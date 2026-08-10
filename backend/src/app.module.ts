import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { CommonModule } from './common/common.module';
import { BullModule } from '@nestjs/bullmq';
import { WebhooksModule } from './webhooks/webhooks.module';

import { IntelligenceModule } from './intelligence/intelligence.module';
import { SlaModule } from './sla/sla.module';
import { NotificationsModule } from './notifications/notifications.module';
import { AgentModule } from './agent/agent.module';
import { WhatsappModule } from './whatsapp/whatsapp.module';
import { ReportsModule } from './reports/reports.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { LeadsModule } from './leads/leads.module';
import { OnboardingModule } from './onboarding/onboarding.module';
import { BillingModule } from './billing/billing.module';
import { BillingGuard } from './common/guards/billing.guard';
import { APP_GUARD } from '@nestjs/core';

import { ScheduleModule } from '@nestjs/schedule';
import { ChatsModule } from './chats/chats.module';

@Module({
  imports: [
    PrismaModule,
    CommonModule,
    AuthModule,
    ScheduleModule.forRoot(),
    BullModule.forRoot({
      connection: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379', 10),
        db: 1, // BullMQ uses DB 1 as specified
      },
    }),
    WebhooksModule,
    IntelligenceModule,
    SlaModule,
    NotificationsModule,
    AgentModule,
    WhatsappModule,
    ReportsModule,
    DashboardModule,
    LeadsModule,
    OnboardingModule,
    BillingModule,
    ChatsModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: BillingGuard,
    },
  ],
})
export class AppModule {}
