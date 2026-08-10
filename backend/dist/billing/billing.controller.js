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
var BillingController_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.BillingController = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const jwt_auth_guard_1 = require("../auth/guards/jwt-auth.guard");
const billing_service_1 = require("./billing.service");
let BillingController = BillingController_1 = class BillingController {
    prisma;
    billingService;
    logger = new common_1.Logger(BillingController_1.name);
    constructor(prisma, billingService) {
        this.prisma = prisma;
        this.billingService = billingService;
    }
    async getStatus(req) {
        const tenantId = req.tenantContext.tenantId;
        const tenant = await this.prisma.tenant.findUnique({
            where: { id: tenantId },
            select: {
                plan: true,
                billingStatus: true,
                trialEndsAt: true,
                messagesProcessedThisMonth: true,
                aiDraftsProcessedThisMonth: true,
                customGeminiApiKey: true,
                customOpenAiApiKey: true,
            }
        });
        if (!tenant)
            throw new common_1.UnauthorizedException('Tenant not found');
        const daysRemaining = tenant.trialEndsAt ? Math.max(0, Math.ceil((tenant.trialEndsAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24))) : 0;
        const response = {
            plan: tenant.plan,
            billingStatus: tenant.billingStatus,
            trialEndsAt: tenant.trialEndsAt,
            daysRemaining,
            messagesProcessedThisMonth: tenant.messagesProcessedThisMonth,
            aiDraftsProcessedThisMonth: tenant.aiDraftsProcessedThisMonth,
            hasGeminiKey: !!tenant.customGeminiApiKey,
            hasOpenAiKey: !!tenant.customOpenAiApiKey,
        };
        console.log('API /billing/status RETURNING:', response);
        return response;
    }
    async saveByok(req, body) {
        const tenantId = req.tenantContext.tenantId;
        const data = {};
        if (body.geminiKey !== undefined)
            data.customGeminiApiKey = body.geminiKey || null;
        if (body.openaiKey !== undefined)
            data.customOpenAiApiKey = body.openaiKey || null;
        await this.prisma.tenant.update({
            where: { id: tenantId },
            data,
        });
        return { success: true };
    }
    async generateCheckoutLink(req, body) {
        const tenantId = req.tenantContext.tenantId;
        if (!['GROWTH', 'ENTERPRISE'].includes(body.plan)) {
            throw new Error('Plano inválido para checkout online.');
        }
        return await this.billingService.createCheckoutLink(tenantId, body.plan);
    }
    async handleAsaasWebhook(asaasToken, payload) {
        const validToken = process.env.ASAAS_WEBHOOK_TOKEN;
        if (!validToken || asaasToken !== validToken) {
            this.logger.warn(`Tentativa de acesso não autorizado ao webhook do Asaas. IP: ignorado`);
            throw new common_1.UnauthorizedException('Token de webhook inválido');
        }
        this.logger.log(`Webhook Asaas recebido: Evento ${payload.event}`);
        const customerId = payload.customer;
        if (!customerId) {
            return { success: true };
        }
        const tenant = await this.prisma.tenant.findUnique({
            where: { asaasCustomerId: customerId }
        });
        if (!tenant) {
            this.logger.warn(`Tenant não encontrado para o asaasCustomerId: ${customerId}`);
            return { success: true };
        }
        switch (payload.event) {
            case 'PAYMENT_RECEIVED':
            case 'PAYMENT_CONFIRMED':
                let updatedPlan = tenant.plan;
                const description = payload.payment?.description?.toUpperCase() || '';
                if (description.includes('GROWTH'))
                    updatedPlan = 'GROWTH';
                if (description.includes('ENTERPRISE'))
                    updatedPlan = 'ENTERPRISE';
                await this.prisma.tenant.update({
                    where: { id: tenant.id },
                    data: {
                        billingStatus: 'ACTIVE',
                        plan: updatedPlan,
                        messagesProcessedThisMonth: 0,
                        aiDraftsProcessedThisMonth: 0,
                    }
                });
                if (payload.payment) {
                    await this.prisma.billingInvoice.create({
                        data: {
                            tenantId: tenant.id,
                            amount: payload.payment.value || 0,
                            status: 'PAID',
                            paymentMethod: payload.payment.billingType || 'UNKNOWN',
                            invoiceUrl: payload.payment.invoiceUrl,
                            dueDate: new Date(payload.payment.dueDate),
                            paidAt: new Date(),
                        }
                    });
                }
                break;
            case 'PAYMENT_OVERDUE':
                await this.prisma.tenant.update({
                    where: { id: tenant.id },
                    data: {
                        billingStatus: 'OVERDUE'
                    }
                });
                this.logger.log(`Tenant ${tenant.id} alterado para OVERDUE. Enviar WS evento.`);
                break;
            case 'SUBSCRIPTION_DELETED':
            case 'PAYMENT_REFUNDED':
            case 'PAYMENT_CHARGEBACK_REQUESTED':
                await this.prisma.tenant.update({
                    where: { id: tenant.id },
                    data: {
                        billingStatus: 'SUSPENDED'
                    }
                });
                break;
        }
        return { success: true };
    }
};
exports.BillingController = BillingController;
__decorate([
    (0, common_1.Get)('status'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], BillingController.prototype, "getStatus", null);
__decorate([
    (0, common_1.Post)('byok'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], BillingController.prototype, "saveByok", null);
__decorate([
    (0, common_1.Post)('checkout-link'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], BillingController.prototype, "generateCheckoutLink", null);
__decorate([
    (0, common_1.Post)('webhook/asaas'),
    __param(0, (0, common_1.Headers)('asaas-access-token')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], BillingController.prototype, "handleAsaasWebhook", null);
exports.BillingController = BillingController = BillingController_1 = __decorate([
    (0, common_1.Controller)('api/v1/billing'),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        billing_service_1.BillingService])
], BillingController);
//# sourceMappingURL=billing.controller.js.map