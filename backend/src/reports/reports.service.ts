import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { IntelligenceService } from '../intelligence/intelligence.service';
import { generateText } from 'ai';
import { google } from '@ai-sdk/google';
const PDFDocument = require('pdfkit');

@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly intelligenceService: IntelligenceService
  ) {}

  async generateWeeklyReport(tenantId: string): Promise<string> {
    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - 7 * 24 * 60 * 60 * 1000);

    // 1. Estatísticas de tempo de resposta
    const messages = await this.prisma.message.findMany({
      where: {
        tenantId,
        createdAt: { gte: startDate, lte: endDate },
        sender: 'AGENT',
        responseTime: { not: null }
      },
      select: { responseTime: true }
    });
    
    const avgResponseTime = messages.length > 0 
      ? messages.reduce((acc, msg) => acc + (msg.responseTime || 0), 0) / messages.length 
      : 0;
    
    // 2. Classificações de perdas
    const conversations = await this.prisma.conversation.findMany({
      where: {
        tenantId,
        createdAt: { gte: startDate, lte: endDate },
        status: 'CLOSED',
        lossReason: { not: null }
      }
    });

    const totalLost = conversations.length;
    const lossReasonsCount = conversations.reduce((acc, conv) => {
      if (conv.lossReason) {
        const reason = conv.lossReason;
        acc[reason] = (acc[reason] || 0) + 1;
      }
      return acc;
    }, {} as Record<string, number>);

    // 3. Demandas não mapeadas
    const consolidatedDemands = await this.intelligenceService.consolidateDemands(tenantId, startDate, endDate);

    const statsContext = `
      Estatísticas dos últimos 7 dias:
      - Tempo médio de resposta do agente: ${avgResponseTime.toFixed(2)} segundos.
      - Total de oportunidades perdidas: ${totalLost}.
      - Motivos de perda: ${JSON.stringify(lossReasonsCount)}.
      - Demandas não mapeadas consolidadas: ${JSON.stringify(consolidatedDemands)}.
    `;

    const systemPrompt = `
      Você é um consultor gerencial especialista em negócios.
      Sua tarefa é analisar os dados fornecidos e produzir um relatório gerencial em Markdown contendo recomendações explícitas e acionáveis.
      Estruture as análises sob o padrão (Obrigatório!):
      **Fato:** (Identificado)
      **Impacto:** (No negócio)
      **Sugestão Prática:** (Como resolver)
      
      Não gere textos desnecessários, vá direto ao ponto e agregue valor com os insights.
    `;

    try {
      this.logger.debug('Gerando relatório narrativo com gemini-1.5-pro');
      const { text } = await generateText({
        model: google('gemini-1.5-pro'),
        system: systemPrompt,
        prompt: `Gere o relatório gerencial com base nestes dados:\n${statsContext}`,
      });

      return text;
    } catch (error) {
      this.logger.error(`Erro ao gerar relatório: ${error.message}`);
      throw new Error('Falha ao gerar o relatório gerencial');
    }
  }

  generatePdfStream(markdown: string): PDFKit.PDFDocument {
    const doc = new PDFDocument({ margin: 50 });
    
    // Cabeçalho
    doc.fontSize(20).text('Relatorio Gerencial - VendoraAI', { align: 'center' });
    doc.moveDown();
    doc.fontSize(12).text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')}`, { align: 'center' });
    doc.moveDown(2);

    const cleanText = markdown.replace(/\*\*(.*?)\*\*/g, '$1'); 
    
    doc.fontSize(12).text(cleanText, {
      align: 'left',
      lineGap: 5
    });

    doc.moveDown(2);
    doc.fontSize(10).text('Assinatura: VendoraAI - Consultor Gerencial Automatico', { align: 'right' });

    doc.end();
    return doc;
  }
}
