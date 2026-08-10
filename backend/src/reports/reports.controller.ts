import { Controller, Get, Req, Res, UseGuards } from '@nestjs/common';
import { ReportsService } from './reports.service';
import type { FastifyReply } from 'fastify';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('api/v1/reports')
@UseGuards(JwtAuthGuard)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('weekly')
  async getWeeklyReport(@Req() req: any) {
    const tenantId = req.user.tenantId;
    const markdown = await this.reportsService.generateWeeklyReport(tenantId);
    return { report: markdown };
  }

  @Get('weekly/download')
  async downloadWeeklyReport(@Req() req: any, @Res() res: FastifyReply) {
    const tenantId = req.user.tenantId;
    const markdown = await this.reportsService.generateWeeklyReport(tenantId);
    
    const pdfDoc = this.reportsService.generatePdfStream(markdown);
    
    res.header('Content-Type', 'application/pdf');
    res.header('Content-Disposition', 'attachment; filename=relatorio-semanal.pdf');
    
    res.send(pdfDoc);
  }
}
