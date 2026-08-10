"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WhatsappModule = void 0;
const common_1 = require("@nestjs/common");
const bullmq_1 = require("@nestjs/bullmq");
const whatsapp_outbound_processor_1 = require("./whatsapp-outbound.processor");
const prisma_module_1 = require("../prisma/prisma.module");
const whatsapp_channels_controller_1 = require("./whatsapp-channels.controller");
const whatsapp_channels_service_1 = require("./whatsapp-channels.service");
const whatsapp_qrcode_service_1 = require("./whatsapp-qrcode.service");
const auth_module_1 = require("../auth/auth.module");
const security_module_1 = require("../security/security.module");
const notifications_module_1 = require("../notifications/notifications.module");
let WhatsappModule = class WhatsappModule {
};
exports.WhatsappModule = WhatsappModule;
exports.WhatsappModule = WhatsappModule = __decorate([
    (0, common_1.Module)({
        imports: [
            prisma_module_1.PrismaModule,
            auth_module_1.AuthModule,
            security_module_1.SecurityModule,
            notifications_module_1.NotificationsModule,
            bullmq_1.BullModule.registerQueue({
                name: 'whatsapp-ingestion',
            }),
        ],
        controllers: [whatsapp_channels_controller_1.WhatsAppChannelsController],
        providers: [whatsapp_outbound_processor_1.WhatsappOutboundProcessor, whatsapp_channels_service_1.WhatsAppChannelsService, whatsapp_qrcode_service_1.WhatsappQrCodeService],
    })
], WhatsappModule);
//# sourceMappingURL=whatsapp.module.js.map