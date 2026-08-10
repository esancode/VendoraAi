import { PrismaService } from '../prisma/prisma.service';
import { IntelligenceService } from '../intelligence/intelligence.service';
export declare class ReportsService {
    private readonly prisma;
    private readonly intelligenceService;
    private readonly logger;
    constructor(prisma: PrismaService, intelligenceService: IntelligenceService);
    generateWeeklyReport(tenantId: string): Promise<string>;
    generatePdfStream(markdown: string): PDFKit.PDFDocument;
}
