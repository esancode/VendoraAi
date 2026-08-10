import { z } from 'zod';

export const LossClassificationSchema = z.object({
  status: z.enum(['WON', 'LOST', 'ONGOING']),
  reasonCategory: z.enum(['PRICE', 'DELIVERY', 'PRODUCT', 'COMPETITION', 'SERVICE', 'OTHER']).nullable()
    .describe('Categoria semântica principal que levou à perda do lead, ou null se ativo/ganho.'),
  confidenceScore: z.number().min(0).max(1)
    .describe('Grau de certeza matemática do modelo na classificação efetuada de 0 a 1.'),
  semanticAnalysis: z.string().max(250)
    .describe('Breve resumo narrativo do motivo de perda ou status da conversa em português.'),
  unmappedDemands: z.array(z.string())
    .describe('Lista de produtos ou funcionalidades solicitados pelo cliente que a empresa não oferece.')
});

export type LossClassification = z.infer<typeof LossClassificationSchema>;
