import { Controller, Get, Post, Param, UseGuards, Req, Logger } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ChatsService } from './chats.service';
import type { FastifyRequest } from 'fastify';

@Controller('api/v1/chats')
@UseGuards(JwtAuthGuard)
export class ChatsController {
  private readonly logger = new Logger(ChatsController.name);

  constructor(private readonly chatsService: ChatsService) {}

  @Get()
  async getActiveChats(@Req() req: FastifyRequest) {
    const tenantId = req.tenantContext!.tenantId;
    return await this.chatsService.getActiveChats(tenantId);
  }

  @Get(':id/messages')
  async getMessages(@Req() req: FastifyRequest, @Param('id') leadId: string) {
    const tenantId = req.tenantContext!.tenantId;
    return await this.chatsService.getMessages(tenantId, leadId);
  }

  @Post(':id/draft')
  async generateDraft(@Req() req: FastifyRequest, @Param('id') leadId: string) {
    const tenantId = req.tenantContext!.tenantId;
    return await this.chatsService.generateDraft(tenantId, leadId);
  }
}
