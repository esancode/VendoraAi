import { Module } from '@nestjs/common';
import { AiOrchestratorService } from './ai-orchestrator.service';
import { IntelligencePipelineProcessor } from './intelligence-pipeline.processor';
import { SecurityModule } from '../security/security.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { BullModule } from '@nestjs/bullmq';

import { KnowledgeService } from './knowledge.service';
import { KnowledgeController } from './knowledge.controller';
import { SessaoInatividadeService } from './sessao-inatividade.service';
import { IntelligenceService } from './intelligence.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    SecurityModule, 
    NotificationsModule,
    AuthModule,
    BullModule.registerQueue({ name: 'whatsapp-outbound' }),
  ],
  providers: [AiOrchestratorService, IntelligencePipelineProcessor, KnowledgeService, SessaoInatividadeService, IntelligenceService],
  controllers: [KnowledgeController],
  exports: [AiOrchestratorService, KnowledgeService, IntelligenceService],
})
export class IntelligenceModule {}
