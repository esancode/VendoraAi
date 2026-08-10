import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AiOrchestratorService } from '../intelligence/ai-orchestrator.service';
import { NotificationGateway } from '../notifications/notification.gateway';

@Processor('retroactive-audit')
export class RetroactiveAuditProcessor extends WorkerHost {
  private readonly logger = new Logger(RetroactiveAuditProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly aiOrchestrator: AiOrchestratorService,
    private readonly notificationGateway: NotificationGateway,
  ) {
    super();
  }

  async process(job: Job<any, any, string>): Promise<any> {
    this.logger.log(`Iniciando processamento de auditoria retroativa (Job ID: ${job.id})`);
    
    const { tenantId, channelId } = job.data;

    if (!tenantId || !channelId) {
      this.logger.error('Faltando tenantId ou channelId no job.');
      return;
    }

    // 1. Simulação de ingestão de conversas históricas (já que syncFullHistory=false no Baileys)
    // Criaremos 5 conversas representativas de perdas para que o Gemini as analise
    const mockHistories = [
      {
        phone: '5511999991111',
        name: 'Carlos Oliveira',
        text: 'Cliente: Olá, gostaria de saber o valor da integração.\nVendedor: Oi Carlos! Custa R$ 5.000.\nCliente: Nossa, está muito fora do meu orçamento. Achei muito caro. Vou deixar para a próxima.',
        sla: 850, // 14 mins
      },
      {
        phone: '5511999992222',
        name: 'Fernanda Souza',
        text: 'Cliente: Preciso do sistema para ontem, quanto tempo para entregar?\nVendedor: Olá Fernanda, demoramos 30 dias úteis.\nCliente: Não dá, preciso de algo imediato. Vou procurar outro fornecedor.',
        sla: 2700, // 45 mins
      },
      {
        phone: '5511999993333',
        name: 'Roberto Costa',
        text: 'Cliente: Vi que a plataforma XYZ (concorrente) tem esse mesmo recurso por metade do preço e com Salesforce. Vocês integram com Salesforce?\nVendedor: Olá Roberto. Não integramos com Salesforce no momento.\nCliente: Então não serve para mim, vou fechar com a XYZ.',
        sla: 1360, // 22 mins
      },
      {
        phone: '5511999994444',
        name: 'Ana Pereira',
        text: 'Cliente: Vocês têm suporte 24/7?\nVendedor: Olá Ana, nosso suporte é apenas em horário comercial.\nCliente: Poxa, minha operação não para, preciso de 24/7. Que pena.',
        sla: 495, // 8 mins
      },
      {
        phone: '5511999995555',
        name: 'João Silva',
        text: 'Cliente: Vocês oferecem plano anual com desconto para PMEs?\nVendedor: Olá João, apenas preço de tabela mensal.\nCliente: Fica difícil assim. Obrigado.',
        sla: 1360, // 22 mins
      }
    ];

    try {
      let processedMessagesCount = 0;

      // Pegamos o primeiro agentId disponível (ou null) para simular o atendente
      const agent = await this.prisma.agent.findFirst({ where: { tenantId } });

      for (const history of mockHistories) {
        // Criar ou atualizar Lead
        const lead = await this.prisma.lead.upsert({
          where: {
            tenantId_phone: {
              tenantId,
              phone: history.phone
            }
          },
          update: {},
          create: {
            tenantId,
            name: history.name,
            phone: history.phone,
            status: 'LOST'
          }
        });

        // Criar Conversation
        const conversation = await this.prisma.conversation.create({
          data: {
            tenantId,
            leadId: lead.id,
            status: 'OPEN',
            agentId: agent?.id
          }
        });

        // 2. Acionar a IA (Gemini)
        this.logger.log(`Enviando conversa do lead ${history.name} para o Gemini...`);
        
        try {
          const analysis = await this.aiOrchestrator.analyzeConversation(history.text);
          
          // Mapeamento simplificado do enum do Prisma baseado no reasonCategory retornado pela IA
          let mappedReason = 'OTHER';
          const reasonCat = analysis.classification.reasonCategory;
          if (reasonCat === 'PRICE') mappedReason = 'PRICE';
          else if (reasonCat === 'COMPETITION') mappedReason = 'COMPETITION';
          else if (reasonCat === 'DELIVERY') mappedReason = 'DELIVERY'; // usando DELIVERY para prazo
          else if (reasonCat === 'PRODUCT') mappedReason = 'PRODUCT';
          else if (reasonCat === 'SERVICE') mappedReason = 'SERVICE';

          // Atualizar Conversation no BD
          await this.prisma.conversation.update({
            where: { id: conversation.id },
            data: {
              status: 'CLOSED',
              lossReason: mappedReason as any,
              lossReasonDetail: analysis.classification.semanticAnalysis || 'N/A',
              confidenceScore: analysis.classification.confidenceScore || 0.9,
              responseSlaSeconds: history.sla,
              unmappedDemands: analysis.classification.unmappedDemands || [],
              closedAt: new Date()
            }
          });
          
          processedMessagesCount += 3; // simulando 3 mensagens por conversa

        } catch (error) {
          this.logger.error(`Erro ao analisar conversa com Gemini: ${error.message}`);
        }
      }

      // 3. Marcar Tenant como Onboarding Completo
      await this.prisma.tenant.update({
        where: { id: tenantId },
        data: { onboardingCompleted: true }
      });

      this.logger.log(`Auditoria concluída com sucesso para o tenant ${tenantId}`);

      // 4. Emitir WebSocket Push
      this.notificationGateway.broadcastToTenant(tenantId, 'dashboard.data_ready', {
        message: 'Auditoria retroativa finalizada',
        processedMessages: processedMessagesCount
      });

    } catch (error) {
      this.logger.error(`Erro crítico no processamento retroativo: ${error.message}`);
    }
  }
}
