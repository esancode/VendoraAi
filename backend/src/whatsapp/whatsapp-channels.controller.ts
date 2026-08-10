import { Controller, Get, Post, Body, Patch, Param, Delete, Req, UseGuards, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { WhatsAppChannelsService, CreateWhatsAppChannelSchema } from './whatsapp-channels.service';
import { WhatsappQrCodeService } from './whatsapp-qrcode.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { FastifyRequest } from 'fastify';
import { z } from 'zod';

const BindAgentSchema = z.object({
  agentId: z.string().uuid().nullable(),
});

@Controller('api/v1/whatsapp-channels')
// Controlador de Canais (Restarting Server to pick up Prisma Client)
@UseGuards(JwtAuthGuard)
export class WhatsAppChannelsController {
  constructor(
    private readonly channelsService: WhatsAppChannelsService,
    private readonly qrCodeService: WhatsappQrCodeService,
  ) {}

  @Get()
  async listChannels(@Req() req: FastifyRequest) {
    const tenantId = req.tenantContext!.tenantId;
    return await this.channelsService.listChannels(tenantId);
  }

  @Post()
  async createChannel(@Req() req: FastifyRequest, @Body() body: any) {
    const tenantId = req.tenantContext!.tenantId;
    
    const parsed = CreateWhatsAppChannelSchema.safeParse(body);
    if (!parsed.success) {
      throw new UnauthorizedException('Invalid request body');
    }
    
    return await this.channelsService.createChannel(tenantId, parsed.data);
  }

  @Patch(':id/bind-agent')
  async bindAgent(
    @Req() req: FastifyRequest,
    @Param('id') id: string,
    @Body() body: any,
  ) {
    const tenantId = req.tenantContext!.tenantId;
    
    const parsed = BindAgentSchema.safeParse(body);
    if (!parsed.success) {
      throw new UnauthorizedException('Invalid request body');
    }
    
    return await this.channelsService.bindAgent(tenantId, id, parsed.data.agentId);
  }

  @Delete(':id')
  async deleteChannel(@Req() req: FastifyRequest, @Param('id') id: string) {
    const tenantId = req.tenantContext!.tenantId;
    return await this.channelsService.deleteChannel(tenantId, id);
  }

  @Post(':id/connect')
  async connectChannel(@Req() req: FastifyRequest, @Param('id') id: string) {
    const tenantId = req.tenantContext!.tenantId;
    
    // Validar o formato do número do canal antes de conectar
    const channels = await this.channelsService.listChannels(tenantId);
    const channel = channels.find(c => c.id === id);
    if (!channel) throw new BadRequestException('Canal não encontrado');
    
    if (!/^\+?\d{10,15}$/.test(channel.phoneNumber)) {
      throw new BadRequestException('Número de telefone inválido para conexão.');
    }

    await this.qrCodeService.initializeSession(tenantId, id);
    return { message: 'Initialization started' };
  }

  @Post(':id/disconnect')
  async disconnectChannel(@Req() req: FastifyRequest, @Param('id') id: string) {
    const tenantId = req.tenantContext!.tenantId;
    await this.qrCodeService.disconnectSession(tenantId, id);
    return { message: 'Disconnected successfully' };
  }
}
