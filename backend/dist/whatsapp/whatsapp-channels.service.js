"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WhatsAppChannelsService = exports.CreateWhatsAppChannelSchema = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const zod_1 = require("zod");
exports.CreateWhatsAppChannelSchema = zod_1.z.object({
    name: zod_1.z.string().min(1, 'O nome do canal é obrigatório.'),
    phoneNumber: zod_1.z.string().regex(/^\+?\d{10,15}$/, 'Número de telefone inválido para conexão.'),
    agentId: zod_1.z.string().uuid().optional().nullable(),
});
let WhatsAppChannelsService = class WhatsAppChannelsService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async listChannels(tenantId) {
        return await this.prisma.runInTenantContext(tenantId, async (tx) => {
            return await tx.whatsAppChannel.findMany({
                orderBy: { createdAt: 'desc' },
            });
        });
    }
    async createChannel(tenantId, data) {
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
        }
        catch (error) {
            if (error?.code === 'P2002' && error?.meta?.target?.includes('phone_number')) {
                throw new common_1.BadRequestException('Este número de telefone já está cadastrado em outro canal.');
            }
            throw error;
        }
    }
    async bindAgent(tenantId, channelId, agentId) {
        return await this.prisma.runInTenantContext(tenantId, async (tx) => {
            const channel = await tx.whatsAppChannel.findUnique({
                where: { id: channelId },
            });
            if (!channel) {
                throw new common_1.NotFoundException('Canal não encontrado');
            }
            if (agentId) {
                const agent = await tx.agent.findUnique({
                    where: { id: agentId },
                });
                if (!agent) {
                    throw new common_1.NotFoundException('Agente não encontrado no seu tenant');
                }
            }
            return await tx.whatsAppChannel.update({
                where: { id: channelId },
                data: { agentId },
            });
        });
    }
    async deleteChannel(tenantId, channelId) {
        return await this.prisma.runInTenantContext(tenantId, async (tx) => {
            const channel = await tx.whatsAppChannel.findUnique({
                where: { id: channelId },
            });
            if (!channel) {
                throw new common_1.NotFoundException('Canal não encontrado');
            }
            return await tx.whatsAppChannel.delete({
                where: { id: channelId },
            });
        });
    }
};
exports.WhatsAppChannelsService = WhatsAppChannelsService;
exports.WhatsAppChannelsService = WhatsAppChannelsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], WhatsAppChannelsService);
//# sourceMappingURL=whatsapp-channels.service.js.map