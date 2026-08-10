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
var WhatsappOutboundProcessor_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.WhatsappOutboundProcessor = void 0;
const bullmq_1 = require("@nestjs/bullmq");
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const client_1 = require("@prisma/client");
let WhatsappOutboundProcessor = WhatsappOutboundProcessor_1 = class WhatsappOutboundProcessor extends bullmq_1.WorkerHost {
    prisma;
    logger = new common_1.Logger(WhatsappOutboundProcessor_1.name);
    constructor(prisma) {
        super();
        this.prisma = prisma;
    }
    async process(job) {
        const { tenantId, leadId, conversationId, content } = job.data;
        this.logger.log(`Processando disparo agendado para Lead: ${leadId}`);
        await this.prisma.runInTenantContext(tenantId, async (tx) => {
            const lead = await tx.lead.findUnique({ where: { id: leadId } });
            if (!lead) {
                this.logger.warn(`Lead ${leadId} não encontrado. Abortando envio.`);
                return;
            }
            if (lead.status === client_1.LeadStatus.MANUAL_INTERVENTION_REQUIRED) {
                this.logger.warn(`Envio abortado: Lead ${leadId} entrou em intervenção manual durante o delay.`);
                return;
            }
            this.logger.log(`[WHATSAPP-API-MOCK] Enviando mensagem final: "${content}"`);
            await tx.message.create({
                data: {
                    conversationId,
                    tenantId,
                    sender: client_1.MessageSender.SYSTEM,
                    rawContent: content,
                    maskedContent: content,
                },
            });
            this.logger.log(`Mensagem autônoma despachada e registrada com sucesso.`);
        });
    }
};
exports.WhatsappOutboundProcessor = WhatsappOutboundProcessor;
exports.WhatsappOutboundProcessor = WhatsappOutboundProcessor = WhatsappOutboundProcessor_1 = __decorate([
    (0, bullmq_1.Processor)('whatsapp-outbound'),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], WhatsappOutboundProcessor);
//# sourceMappingURL=whatsapp-outbound.processor.js.map