import { Controller, Get, Post, Body, UseGuards, Req, Delete, Param, Query } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { KnowledgeService } from './knowledge.service';
import { PrismaService } from '../prisma/prisma.service';
import type { FastifyRequest } from 'fastify';

@Controller('api/v1/knowledge-sources')
@UseGuards(JwtAuthGuard)
export class KnowledgeController {
  constructor(
    private readonly knowledgeService: KnowledgeService,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  async getKnowledgeSources(@Req() req: FastifyRequest, @Query('agentId') agentId: string) {
    const tenantId = req.tenantContext!.tenantId;
    const sources = await this.prisma.knowledgeSource.findMany({
      where: { tenantId, agentId },
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        title: true,
        content: true,
        updatedAt: true,
      },
    });

    // Anexamos um mock do status e count pois o Prisma schema original
    // talvez não os mapeie de forma simples ou processamento assíncrono seria usado no mundo real.
    return sources.map((s) => ({
      ...s,
      status: 'COMPLETED',
      chunkCount: 1, // Um mock simples por agora, o foco é a rota existir
    }));
  }

  @Post()
  async createKnowledgeSource(@Req() req: FastifyRequest, @Body() body: { title: string; content: string; agentId: string }) {
    const tenantId = req.tenantContext!.tenantId;
    const { title, content, agentId } = body;
    
    // O service cuida de quebrar em chunks e embeddar via gemini
    await this.knowledgeService.createSource(tenantId, agentId, title, content);
    
    return { success: true };
  }

  @Delete(':id')
  async deleteKnowledgeSource(@Req() req: FastifyRequest, @Param('id') id: string, @Query('agentId') agentId: string) {
    const tenantId = req.tenantContext!.tenantId;
    await this.knowledgeService.deleteSource(tenantId, agentId, id);
    return { success: true };
  }
}
