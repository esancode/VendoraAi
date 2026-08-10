import { Module } from '@nestjs/common';
import { AgentReplyService } from './agent-reply.service';
import { AgentService } from './agent.service';
import { AgentController } from './agent.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { SlaModule } from '../sla/sla.module';
import { BullModule } from '@nestjs/bullmq';

import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    PrismaModule,
    SlaModule,
    AuthModule,
    BullModule.registerQueue({
      name: 'customer-notification',
    }),
  ],
  controllers: [AgentController],
  providers: [AgentReplyService, AgentService],
  exports: [AgentReplyService, AgentService],
})
export class AgentModule {}
