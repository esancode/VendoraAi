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
exports.WhatsappIngestionProcessor = void 0;
const bullmq_1 = require("@nestjs/bullmq");
const bullmq_2 = require("bullmq");
const prisma_service_1 = require("../prisma/prisma.service");
const client_1 = require("@prisma/client");
const encryption_service_1 = require("../security/encryption.service");
const sanitizer_service_1 = require("../security/sanitizer.service");
const sla_service_1 = require("../sla/sla.service");
let WhatsappIngestionProcessor = class WhatsappIngestionProcessor extends bullmq_1.WorkerHost {
    prisma;
    encryptionService;
    sanitizerService;
    slaService;
    intelligenceQueue;
    notificationQueue;
    constructor(prisma, encryptionService, sanitizerService, slaService, intelligenceQueue, notificationQueue) {
        super();
        this.prisma = prisma;
        this.encryptionService = encryptionService;
        this.sanitizerService = sanitizerService;
        this.slaService = slaService;
        this.intelligenceQueue = intelligenceQueue;
        this.notificationQueue = notificationQueue;
    }
    async process(job) {
        const payload = job.data;
        const entry = payload.entry[0];
        const changes = entry.changes[0];
        const value = changes.value;
        const contact = value.contacts && value.contacts[0];
        const message = value.messages[0];
        const wamid = message.id;
        const fromPhone = message.from;
        const contactName = contact ? contact.profile.name : 'Unknown';
        const textContent = message.text ? message.text.body : '';
        const timestamp = message.timestamp ? new Date(parseInt(message.timestamp) * 1000) : new Date();
        const metadata = value.metadata;
        const phoneNumberId = metadata?.phone_number_id;
        if (!phoneNumberId) {
            throw new Error('No phone_number_id found in webhook payload. Cannot route message.');
        }
        const channel = await this.prisma.whatsAppChannel.findUnique({
            where: { id: phoneNumberId },
        });
        if (!channel) {
            throw new Error(`WhatsApp Channel not registered for phone_number_id ${phoneNumberId}.`);
        }
        const tenantId = channel.tenantId;
        const agentId = channel.agentId;
        const encryptedPhone = this.encryptionService.encryptDeterministic(fromPhone);
        const encryptedName = this.encryptionService.encrypt(contactName);
        const maskedContent = await this.sanitizerService.sanitize(textContent, tenantId, wamid);
        const slaDurationMinutes = 30;
        const slaLimitAt = this.slaService.calculateSlaLimit(timestamp, slaDurationMinutes);
        const result = await this.prisma.runInTenantContext(tenantId, async (tx) => {
            const lead = await tx.lead.upsert({
                where: {
                    tenantId_phone: {
                        tenantId,
                        phone: encryptedPhone,
                    },
                },
                create: {
                    tenantId,
                    phone: encryptedPhone,
                    name: encryptedName,
                    lastInteractionAt: timestamp,
                    slaLimitAt,
                },
                update: {
                    name: encryptedName,
                    lastInteractionAt: timestamp,
                    slaLimitAt,
                },
            });
            let conversation = await tx.conversation.findFirst({
                where: {
                    tenantId,
                    leadId: lead.id,
                    status: client_1.ConversationStatus.OPEN,
                },
            });
            if (!conversation) {
                conversation = await tx.conversation.create({
                    data: {
                        tenantId,
                        leadId: lead.id,
                        agentId,
                        status: client_1.ConversationStatus.OPEN,
                    },
                });
            }
            const savedMessage = await tx.message.create({
                data: {
                    tenantId,
                    conversationId: conversation.id,
                    sender: client_1.MessageSender.CUSTOMER,
                    rawContent: textContent,
                    maskedContent: maskedContent,
                    createdAt: timestamp,
                },
            });
            return { leadId: lead.id, messageId: savedMessage.id };
        });
        if (agentId) {
            await this.intelligenceQueue.add('analyze-conversation', {
                tenantId,
                leadId: result.leadId,
                messageId: result.messageId,
                agentId,
            });
        }
        else {
            await this.prisma.runInTenantContext(tenantId, async (tx) => {
                await tx.lead.update({
                    where: { id: result.leadId },
                    data: { needsHumanReview: true, status: 'MANUAL_INTERVENTION_REQUIRED' },
                });
            });
        }
        const now = new Date();
        const totalSlaMsRemaining = Math.max(0, slaLimitAt.getTime() - now.getTime());
        const warningSlaMsRemaining = Math.max(0, totalSlaMsRemaining * 0.8);
        await this.notificationQueue.add('lead.sla_warning', {
            tenantId,
            leadId: result.leadId,
        }, {
            jobId: `sla-warn-${result.leadId}`,
            delay: warningSlaMsRemaining,
        });
        await this.notificationQueue.add('lead.sla_breached', {
            tenantId,
            leadId: result.leadId,
        }, {
            jobId: `sla-breach-${result.leadId}`,
            delay: totalSlaMsRemaining,
        });
    }
};
exports.WhatsappIngestionProcessor = WhatsappIngestionProcessor;
exports.WhatsappIngestionProcessor = WhatsappIngestionProcessor = __decorate([
    (0, bullmq_1.Processor)('whatsapp-ingestion'),
    __param(4, (0, bullmq_1.InjectQueue)('intelligence-pipeline')),
    __param(5, (0, bullmq_1.InjectQueue)('customer-notification')),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        encryption_service_1.EncryptionService,
        sanitizer_service_1.SanitizerService,
        sla_service_1.SlaService,
        bullmq_2.Queue,
        bullmq_2.Queue])
], WhatsappIngestionProcessor);
//# sourceMappingURL=whatsapp-ingestion.processor.js.map