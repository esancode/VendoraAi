"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LossClassificationSchema = void 0;
const zod_1 = require("zod");
exports.LossClassificationSchema = zod_1.z.object({
    status: zod_1.z.enum(['WON', 'LOST', 'ONGOING']),
    reasonCategory: zod_1.z.enum(['PRICE', 'DELIVERY', 'PRODUCT', 'COMPETITION', 'SERVICE', 'OTHER']).nullable()
        .describe('Categoria semântica principal que levou à perda do lead, ou null se ativo/ganho.'),
    confidenceScore: zod_1.z.number().min(0).max(1)
        .describe('Grau de certeza matemática do modelo na classificação efetuada de 0 a 1.'),
    semanticAnalysis: zod_1.z.string().max(250)
        .describe('Breve resumo narrativo do motivo de perda ou status da conversa em português.'),
    unmappedDemands: zod_1.z.array(zod_1.z.string())
        .describe('Lista de produtos ou funcionalidades solicitados pelo cliente que a empresa não oferece.')
});
//# sourceMappingURL=loss-classification.schema.js.map