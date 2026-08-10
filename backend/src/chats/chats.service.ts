import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AiOrchestratorService } from '../intelligence/ai-orchestrator.service';

@Injectable()
export class ChatsService {
  private readonly logger = new Logger(ChatsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly aiOrchestrator: AiOrchestratorService,
  ) {}

  async getActiveChats(tenantId: string) {
    const leads = await this.prisma.lead.findMany({
      where: {
        tenantId,
        status: { in: ['ACTIVE', 'MANUAL_INTERVENTION_REQUIRED'] }
      },
      include: {
        conversations: {
          where: { status: 'OPEN' },
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: {
            messages: {
              orderBy: { createdAt: 'desc' },
              take: 1,
            }
          }
        }
      },
      orderBy: { lastInteractionAt: 'desc' },
      take: 50,
    });

    return leads.map(lead => {
      const activeConversation = lead.conversations[0];
      const lastMessage = activeConversation?.messages[0];
      return {
        id: lead.id, // we use lead.id as the identifier for the "chat" list
        name: lead.name,
        phone: lead.phone,
        status: lead.status,
        lastMessage: lastMessage ? lastMessage.rawContent || lastMessage.maskedContent : null,
        lastMessageAt: lastMessage?.createdAt || lead.lastInteractionAt,
        conversationId: activeConversation?.id,
        unreadCount: 0 // Simplificado
      };
    });
  }

  async getMessages(tenantId: string, leadId: string) {
    // First, find the active conversation for this lead
    const lead = await this.prisma.lead.findUnique({
      where: { id: leadId, tenantId },
      include: {
        conversations: {
          where: { status: 'OPEN' },
          orderBy: { createdAt: 'desc' },
          take: 1,
        }
      }
    });

    if (!lead || !lead.conversations.length) {
      return [];
    }

    const conversationId = lead.conversations[0].id;

    const messages = await this.prisma.message.findMany({
      where: { conversationId, tenantId },
      orderBy: { createdAt: 'asc' },
    });

    return messages.map(m => ({
      id: m.id,
      text: m.rawContent || m.maskedContent,
      sender: m.sender === 'CUSTOMER' ? 'customer' : 'agent',
      timestamp: m.createdAt.toISOString()
    }));
  }

  async generateDraft(tenantId: string, leadId: string) {
    const lead = await this.prisma.lead.findUnique({
      where: { id: leadId, tenantId },
      include: {
        conversations: {
          where: { status: 'OPEN' },
          orderBy: { createdAt: 'desc' },
          take: 1,
        }
      }
    });

    if (!lead || !lead.conversations.length) {
      throw new NotFoundException('Nenhuma conversa ativa encontrada para este lead.');
    }

    const conversation = lead.conversations[0];
    
    // Buscar últimas mensagens para gerar o histórico
    const messages = await this.prisma.message.findMany({
      where: { conversationId: conversation.id, tenantId },
      orderBy: { createdAt: 'asc' },
      take: 20, // Pega as ultimas 20 mensagens
    });

    let historyStr = '';
    for (const msg of messages) {
      const prefix = msg.sender === 'CUSTOMER' ? '[CUSTOMER]: ' : '[AGENT]: ';
      const content = msg.rawContent || msg.maskedContent || '';
      historyStr += `${prefix}${content}\n`;
    }

    // Call orchestrator
    const draft = await this.aiOrchestrator.generateReplyDraft(historyStr, tenantId, false, conversation.agentId || undefined);
    
    return { draft };
  }
}
