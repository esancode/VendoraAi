import { Controller, Get, Post, Body, HttpCode, HttpStatus, Req, UnauthorizedException, UseGuards, Delete, Param, Put } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { AgentReplyService } from './agent-reply.service';
import { AgentService } from './agent.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { z } from 'zod';

const ReplySchema = z.object({
  leadId: z.string().uuid(),
  content: z.string().min(1),
  tenantId: z.string().uuid(), // For simulation purposes. Normally extracted from JWT.
  agentId: z.string().uuid(), // Agora exige o agentId também
});

@Controller('api/v1/agents') // Mudando para plural
export class AgentController {
  constructor(
    private readonly agentReplyService: AgentReplyService,
    private readonly agentService: AgentService,
  ) {}

  @UseGuards(JwtAuthGuard)
  @Get()
  async listAgents(@Req() req: FastifyRequest) {
    const tenantId = req.tenantContext!.tenantId;
    return await this.agentService.listAgents(tenantId);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  async getAgent(@Req() req: FastifyRequest, @Param('id') id: string) {
    const tenantId = req.tenantContext!.tenantId;
    return await this.agentService.getAgent(tenantId, id);
  }

  @UseGuards(JwtAuthGuard)
  @Post()
  async createAgent(@Req() req: FastifyRequest, @Body() body: any) {
    const tenantId = req.tenantContext!.tenantId;
    return await this.agentService.createAgent(tenantId, body);
  }

  @UseGuards(JwtAuthGuard)
  @Put(':id')
  async updateAgent(@Req() req: FastifyRequest, @Param('id') id: string, @Body() body: any) {
    const tenantId = req.tenantContext!.tenantId;
    return await this.agentService.updateAgent(tenantId, id, body);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  async deleteAgent(@Req() req: FastifyRequest, @Param('id') id: string) {
    const tenantId = req.tenantContext!.tenantId;
    return await this.agentService.deleteAgent(tenantId, id);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id/examples')
  async listExamples(@Req() req: FastifyRequest, @Param('id') id: string) {
    const tenantId = req.tenantContext!.tenantId;
    return await this.agentService.listExamples(tenantId, id);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/examples')
  async addExample(@Req() req: FastifyRequest, @Param('id') id: string, @Body() body: { userQuery: string; expectedResponse: string }) {
    const tenantId = req.tenantContext!.tenantId;
    return await this.agentService.addExample(tenantId, id, body);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id/examples/:exampleId')
  async deleteExample(@Req() req: FastifyRequest, @Param('id') id: string, @Param('exampleId') exampleId: string) {
    const tenantId = req.tenantContext!.tenantId;
    return await this.agentService.deleteExample(tenantId, exampleId);
  }

  // Legacy route without JWT for simulation
  @Post('reply')
  @HttpCode(HttpStatus.OK)
  async replyToLead(@Body() body: any) {
    const parsed = ReplySchema.safeParse(body);
    
    if (!parsed.success) {
      throw new UnauthorizedException('Invalid request body');
    }

    const { tenantId, leadId, content, agentId } = parsed.data;

    // TODO: Update AgentReplyService to handle agentId
    const message = await this.agentReplyService.handleAgentReply(tenantId, leadId, content, agentId);
    return { success: true, messageId: message.id };
  }
}
