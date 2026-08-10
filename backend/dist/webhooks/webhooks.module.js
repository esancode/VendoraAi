"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WebhooksModule = void 0;
const common_1 = require("@nestjs/common");
const bullmq_1 = require("@nestjs/bullmq");
const whatsapp_controller_1 = require("./whatsapp.controller");
const idempotency_service_1 = require("./idempotency.service");
const whatsapp_ingestion_processor_1 = require("./whatsapp-ingestion.processor");
const security_module_1 = require("../security/security.module");
const sla_module_1 = require("../sla/sla.module");
let WebhooksModule = class WebhooksModule {
};
exports.WebhooksModule = WebhooksModule;
exports.WebhooksModule = WebhooksModule = __decorate([
    (0, common_1.Module)({
        imports: [
            bullmq_1.BullModule.registerQueue({
                name: 'whatsapp-ingestion',
                defaultJobOptions: {
                    attempts: 5,
                    backoff: {
                        type: 'exponential',
                        delay: 500,
                    },
                },
            }, {
                name: 'intelligence-pipeline',
                defaultJobOptions: {
                    attempts: 3,
                    backoff: {
                        type: 'exponential',
                        delay: 1000,
                    },
                },
            }, {
                name: 'customer-notification',
            }),
            security_module_1.SecurityModule,
            sla_module_1.SlaModule,
        ],
        controllers: [whatsapp_controller_1.WhatsappController],
        providers: [idempotency_service_1.IdempotencyService, whatsapp_ingestion_processor_1.WhatsappIngestionProcessor],
    })
], WebhooksModule);
//# sourceMappingURL=webhooks.module.js.map