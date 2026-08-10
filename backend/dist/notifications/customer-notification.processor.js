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
var CustomerNotificationProcessor_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.CustomerNotificationProcessor = void 0;
const bullmq_1 = require("@nestjs/bullmq");
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const notification_gateway_1 = require("./notification.gateway");
let CustomerNotificationProcessor = CustomerNotificationProcessor_1 = class CustomerNotificationProcessor extends bullmq_1.WorkerHost {
    prisma;
    notificationGateway;
    logger = new common_1.Logger(CustomerNotificationProcessor_1.name);
    constructor(prisma, notificationGateway) {
        super();
        this.prisma = prisma;
        this.notificationGateway = notificationGateway;
    }
    async process(job) {
        const { leadId, tenantId, type } = job.data;
        this.logger.log(`Processing SLA Job: ${job.name} for Lead: ${leadId}`);
        const lead = await this.prisma.lead.findUnique({
            where: { id: leadId },
        });
        if (!lead) {
            this.logger.warn(`Lead ${leadId} not found, ignoring SLA job`);
            return;
        }
        if (!lead.slaLimitAt) {
            this.logger.log(`Lead ${leadId} already answered, discarding SLA job ${job.name}`);
            return;
        }
        if (job.name === 'lead.sla_warning') {
            this.notificationGateway.broadcastToTenant(tenantId, 'lead.sla_warning', {
                leadId,
                message: 'SLA Warning: 80% of SLA time elapsed!',
                slaLimitAt: lead.slaLimitAt,
            });
        }
        else if (job.name === 'lead.sla_breached') {
            this.notificationGateway.broadcastToTenant(tenantId, 'lead.sla_breached', {
                leadId,
                message: 'SLA Breached: 100% of SLA time elapsed!',
                slaLimitAt: lead.slaLimitAt,
            });
        }
    }
};
exports.CustomerNotificationProcessor = CustomerNotificationProcessor;
exports.CustomerNotificationProcessor = CustomerNotificationProcessor = CustomerNotificationProcessor_1 = __decorate([
    (0, bullmq_1.Processor)('customer-notification'),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        notification_gateway_1.NotificationGateway])
], CustomerNotificationProcessor);
//# sourceMappingURL=customer-notification.processor.js.map