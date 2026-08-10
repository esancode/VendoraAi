import { ReportsService } from './reports.service';
import type { FastifyReply } from 'fastify';
export declare class ReportsController {
    private readonly reportsService;
    constructor(reportsService: ReportsService);
    getWeeklyReport(req: any): Promise<{
        report: string;
    }>;
    downloadWeeklyReport(req: any, res: FastifyReply): Promise<void>;
}
