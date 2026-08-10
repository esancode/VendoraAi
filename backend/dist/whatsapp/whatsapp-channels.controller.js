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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WhatsAppChannelsController = void 0;
const common_1 = require("@nestjs/common");
const whatsapp_channels_service_1 = require("./whatsapp-channels.service");
const whatsapp_qrcode_service_1 = require("./whatsapp-qrcode.service");
const jwt_auth_guard_1 = require("../auth/guards/jwt-auth.guard");
const zod_1 = require("zod");
const BindAgentSchema = zod_1.z.object({
    agentId: zod_1.z.string().uuid().nullable(),
});
let WhatsAppChannelsController = class WhatsAppChannelsController {
    channelsService;
    qrCodeService;
    constructor(channelsService, qrCodeService) {
        this.channelsService = channelsService;
        this.qrCodeService = qrCodeService;
    }
    async listChannels(req) {
        const tenantId = req.tenantContext.tenantId;
        return await this.channelsService.listChannels(tenantId);
    }
    async createChannel(req, body) {
        const tenantId = req.tenantContext.tenantId;
        const parsed = whatsapp_channels_service_1.CreateWhatsAppChannelSchema.safeParse(body);
        if (!parsed.success) {
            throw new common_1.UnauthorizedException('Invalid request body');
        }
        return await this.channelsService.createChannel(tenantId, parsed.data);
    }
    async bindAgent(req, id, body) {
        const tenantId = req.tenantContext.tenantId;
        const parsed = BindAgentSchema.safeParse(body);
        if (!parsed.success) {
            throw new common_1.UnauthorizedException('Invalid request body');
        }
        return await this.channelsService.bindAgent(tenantId, id, parsed.data.agentId);
    }
    async deleteChannel(req, id) {
        const tenantId = req.tenantContext.tenantId;
        return await this.channelsService.deleteChannel(tenantId, id);
    }
    async connectChannel(req, id) {
        const tenantId = req.tenantContext.tenantId;
        const channels = await this.channelsService.listChannels(tenantId);
        const channel = channels.find(c => c.id === id);
        if (!channel)
            throw new common_1.BadRequestException('Canal não encontrado');
        if (!/^\+?\d{10,15}$/.test(channel.phoneNumber)) {
            throw new common_1.BadRequestException('Número de telefone inválido para conexão.');
        }
        await this.qrCodeService.initializeSession(tenantId, id);
        return { message: 'Initialization started' };
    }
    async disconnectChannel(req, id) {
        const tenantId = req.tenantContext.tenantId;
        await this.qrCodeService.disconnectSession(tenantId, id);
        return { message: 'Disconnected successfully' };
    }
};
exports.WhatsAppChannelsController = WhatsAppChannelsController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], WhatsAppChannelsController.prototype, "listChannels", null);
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], WhatsAppChannelsController.prototype, "createChannel", null);
__decorate([
    (0, common_1.Patch)(':id/bind-agent'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", Promise)
], WhatsAppChannelsController.prototype, "bindAgent", null);
__decorate([
    (0, common_1.Delete)(':id'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], WhatsAppChannelsController.prototype, "deleteChannel", null);
__decorate([
    (0, common_1.Post)(':id/connect'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], WhatsAppChannelsController.prototype, "connectChannel", null);
__decorate([
    (0, common_1.Post)(':id/disconnect'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], WhatsAppChannelsController.prototype, "disconnectChannel", null);
exports.WhatsAppChannelsController = WhatsAppChannelsController = __decorate([
    (0, common_1.Controller)('api/v1/whatsapp-channels'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    __metadata("design:paramtypes", [whatsapp_channels_service_1.WhatsAppChannelsService,
        whatsapp_qrcode_service_1.WhatsappQrCodeService])
], WhatsAppChannelsController);
//# sourceMappingURL=whatsapp-channels.controller.js.map