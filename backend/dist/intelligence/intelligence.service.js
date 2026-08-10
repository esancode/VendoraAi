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
var IntelligenceService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.IntelligenceService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const ai_1 = require("ai");
const google_1 = require("@ai-sdk/google");
const zod_1 = require("zod");
const ConsolidatedDemandsSchema = zod_1.z.object({
    demands: zod_1.z.array(zod_1.z.object({
        categoria: zod_1.z.string().describe('Nome padronizado da categoria de produto ou serviço'),
        quantidade: zod_1.z.number().describe('Quantidade de intenções mapeadas sob essa categoria')
    }))
});
let IntelligenceService = IntelligenceService_1 = class IntelligenceService {
    prisma;
    logger = new common_1.Logger(IntelligenceService_1.name);
    constructor(prisma) {
        this.prisma = prisma;
    }
    async consolidateDemands(tenantId, startDate, endDate) {
        this.logger.log(`Consolidando demandas para o tenant ${tenantId} de ${startDate.toISOString()} até ${endDate.toISOString()}`);
        const conversations = await this.prisma.conversation.findMany({
            where: {
                tenantId,
                createdAt: { gte: startDate, lte: endDate },
            },
            select: { unmappedDemands: true }
        });
        const allDemands = [];
        for (const conv of conversations) {
            if (conv.unmappedDemands && conv.unmappedDemands.length > 0) {
                allDemands.push(...conv.unmappedDemands);
            }
        }
        if (allDemands.length === 0)
            return [];
        const systemPrompt = `
      Você é um analista de negócios e inteligência de mercado.
      Foi fornecida uma lista bruta de desejos de consumo não atendidos mencionados por clientes.
      Sua tarefa é agrupar essas demandas semanticamente similares sob nomes de categorias de produtos 
      ou serviços normalizados de mercado e classificar a volumetria aproximada de interesse.
    `;
        try {
            this.logger.debug('Agrupando demandas com gemini-1.5-flash');
            const { object } = await (0, ai_1.generateObject)({
                model: (0, google_1.google)('gemini-1.5-flash'),
                schema: ConsolidatedDemandsSchema,
                system: systemPrompt,
                prompt: `Lista bruta de demandas encontradas:\n${JSON.stringify(allDemands)}`,
            });
            return object.demands;
        }
        catch (error) {
            this.logger.error(`Falha ao consolidar demandas: ${error.message}`);
            return [];
        }
    }
};
exports.IntelligenceService = IntelligenceService;
exports.IntelligenceService = IntelligenceService = IntelligenceService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], IntelligenceService);
//# sourceMappingURL=intelligence.service.js.map