import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { z } from 'zod';

export const CreateWhatsAppChannelSchema = z.object({
  name: z.string().min(1, 'O nome do canal é obrigatório.'),
  phoneNumber: z.string().regex(/^\+?\d{10,15}$/, 'Número de telefone inválido para conexão.'),
  agentId: z.string().uuid().optional().nullable(),
});

@Injectable()
export class WhatsAppChannelsService {
  constructor(private readonly prisma: PrismaService) {}

  async listChannels(tenantId: string) {
    return await this.prisma.runInTenantContext(tenantId, async (tx) => {
      return await tx.whatsAppChannel.findMany({
        orderBy: { createdAt: 'desc' },
      });
    });
  }

  async createChannel(tenantId: string, data: z.infer<typeof CreateWhatsAppChannelSchema>) {
    try {
      return await this.prisma.runInTenantContext(tenantId, async (tx) => {
        return await tx.whatsAppChannel.create({
          data: {
            tenantId,
            name: data.name,
            phoneNumber: data.phoneNumber,
            agentId: data.agentId,
          },
        });
      });
    } catch (error: any) {
      if (error?.code === 'P2002' && error?.meta?.target?.includes('phone_number')) {
        throw new BadRequestException('Este número de telefone já está cadastrado em outro canal.');
      }
      throw error;
    }
  }

  async bindAgent(tenantId: string, channelId: string, agentId: string | null) {
    return await this.prisma.runInTenantContext(tenantId, async (tx) => {
      const channel = await tx.whatsAppChannel.findUnique({
        where: { id: channelId },
      });

      if (!channel) {
        throw new NotFoundException('Canal não encontrado');
      }

      if (agentId) {
        // Verifica se o agente existe e pertence ao tenant
        const agent = await tx.agent.findUnique({
          where: { id: agentId },
        });

        if (!agent) {
          throw new NotFoundException('Agente não encontrado no seu tenant');
        }
      }

      return await tx.whatsAppChannel.update({
        where: { id: channelId },
        data: { agentId },
      });
    });
  }

  async deleteChannel(tenantId: string, channelId: string) {
    return await this.prisma.runInTenantContext(tenantId, async (tx) => {
      const channel = await tx.whatsAppChannel.findUnique({
        where: { id: channelId },
      });

      if (!channel) {
        throw new NotFoundException('Canal não encontrado');
      }

      return await tx.whatsAppChannel.delete({
        where: { id: channelId },
      });
    });
  }
}
