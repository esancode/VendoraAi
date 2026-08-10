"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var ReportsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReportsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const intelligence_service_1 = require("../intelligence/intelligence.service");
const ai_1 = require("ai");
const google_1 = require("@ai-sdk/google");
const PDFDocument = require('pdfkit');
let ReportsService = ReportsService_1 = class ReportsService {
    prisma;
    intelligenceService;
    logger = new common_1.Logger(ReportsService_1.name);
    constructor(prisma, intelligenceService) {
        this.prisma = prisma;
        this.intelligenceService = intelligenceService;
    }
    async generateWeeklyReport(tenantId) {
        const endDate = new Date();
        const startDate = new Date(endDate.getTime() - 7 * 24 * 60 * 60 * 1000);
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
        }, {});
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
            const { text } = await (0, ai_1.generateText)({
                model: (0, google_1.google)('gemini-1.5-pro'),
                system: systemPrompt,
                prompt: `Gere o relatório gerencial com base nestes dados:\n${statsContext}`,
            });
            return text;
        }
        catch (error) {
            this.logger.error(`Erro ao gerar relatório: ${error.message}`);
            throw new Error('Falha ao gerar o relatório gerencial');
        }
    }
    generatePdfStream(markdown) {
        const doc = new PDFDocument({ margin: 50 });
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
};
exports.ReportsService = ReportsService;
exports.ReportsService = ReportsService = ReportsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        intelligence_service_1.IntelligenceService])
], ReportsService);
//# sourceMappingURL=reports.service.js.map