import { PrismaService } from '../prisma/prisma.service';
export declare class IntelligenceService {
    private readonly prisma;
    private readonly logger;
    constructor(prisma: PrismaService);
    consolidateDemands(tenantId: string, startDate: Date, endDate: Date): Promise<{
        categoria: string;
        quantidade: number;
    }[]>;
}
