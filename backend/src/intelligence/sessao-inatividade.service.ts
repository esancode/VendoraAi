import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { AiOrchestratorService } from './ai-orchestrator.service';
import { ConversationStatus } from '@prisma/client';

@Injectable()
export class SessaoInatividadeService {
  private readonly logger = new Logger(SessaoInatividadeService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly aiOrchestrator: AiOrchestratorService,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async checkInactiveConversations() {
    this.logger.log('Iniciando verificação de conversas inativas (mais de 12 horas)...');
    
    // Calcula 12 horas atrás
    const twelveHoursAgo = new Date(Date.now() - 12 * 60 * 60 * 1000);

    const inactiveLeads = await this.prisma.lead.findMany({
      where: {
        lastInteractionAt: { lt: twelveHoursAgo },
        conversations: {
          some: { status: ConversationStatus.OPEN }
        }
      },
      include: {
        conversations: {
          where: { status: ConversationStatus.OPEN }
        }
      }
    });

    if (inactiveLeads.length > 0) {
      this.logger.log(`Encontrados ${inactiveLeads.length} leads com conversas inativas.`);
    }

    for (const lead of inactiveLeads) {
      for (const conversation of lead.conversations) {
        try {
          this.logger.debug(`Gerando resumo para conversa inativa: ${conversation.id}`);
          const summary = await this.aiOrchestrator.generateConversationalSummary(conversation.id, lead.tenantId);
          
          await this.prisma.$transaction(async (tx) => {
            // Fecha a conversa
            await tx.conversation.update({
              where: { id: conversation.id },
              data: { 
                status: ConversationStatus.CLOSED,
                closedAt: new Date()
              }
            });

            // Salva o resumo no Lead
            if (summary) {
              await tx.lead.update({
                where: { id: lead.id },
                data: { conversationalSummary: summary }
              });
            }
          });

          this.logger.log(`Conversa ${conversation.id} encerrada por inatividade e resumida no lead ${lead.id}.`);
        } catch (error) {
          this.logger.error(`Erro ao processar inatividade da conversa ${conversation.id}`, error);
        }
      }
    }
  }
}
