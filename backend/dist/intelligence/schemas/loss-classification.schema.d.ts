import { z } from 'zod';
export declare const LossClassificationSchema: z.ZodObject<{
    status: z.ZodEnum<{
        LOST: "LOST";
        WON: "WON";
        ONGOING: "ONGOING";
    }>;
    reasonCategory: z.ZodNullable<z.ZodEnum<{
        PRICE: "PRICE";
        DELIVERY: "DELIVERY";
        PRODUCT: "PRODUCT";
        COMPETITION: "COMPETITION";
        SERVICE: "SERVICE";
        OTHER: "OTHER";
    }>>;
    confidenceScore: z.ZodNumber;
    semanticAnalysis: z.ZodString;
    unmappedDemands: z.ZodArray<z.ZodString>;
}, z.core.$strip>;
export type LossClassification = z.infer<typeof LossClassificationSchema>;
