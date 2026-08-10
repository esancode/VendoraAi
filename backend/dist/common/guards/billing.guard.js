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
var BillingGuard_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.BillingGuard = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../prisma/prisma.service");
let BillingGuard = BillingGuard_1 = class BillingGuard {
    prisma;
    logger = new common_1.Logger(BillingGuard_1.name);
    constructor(prisma) {
        this.prisma = prisma;
    }
    async canActivate(context) {
        const request = context.switchToHttp().getRequest();
        const tenantId = request.tenantContext?.tenantId;
        if (!tenantId) {
            return true;
        }
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
            return true;
        let { billingStatus } = tenant;
        if (billingStatus === 'TRIAL' && tenant.trialEndsAt && new Date() > tenant.trialEndsAt) {
            await this.prisma.tenant.update({
                where: { id: tenantId },
                data: { billingStatus: 'SUSPENDED' },
            });
            billingStatus = 'SUSPENDED';
        }
        if (billingStatus === 'SUSPENDED') {
            const msg = tenant.plan === 'STARTER'
                ? 'Seu período de teste gratuito de 7 dias expirou. Faça o upgrade para continuar.'
                : 'Acesso bloqueado: Sua assinatura está suspensa.';
            throw new common_1.ForbiddenException({
                code: 'SUBSCRIPTION_SUSPENDED',
                message: msg
            });
        }
        const isStarter = tenant.plan === 'STARTER';
        const isGrowth = tenant.plan === 'GROWTH';
        const url = request.url;
        const method = request.method;
        const hasByok = !!tenant.customGeminiApiKey || !!tenant.customOpenAiApiKey;
        if (billingStatus === 'TRIAL' && !hasByok) {
            if (tenant.messagesProcessedThisMonth >= 1000 || tenant.aiDraftsProcessedThisMonth >= 30) {
                if (['POST', 'PUT', 'PATCH'].includes(method) && !url.includes('/billing/')) {
                    throw new common_1.ForbiddenException('Limite de consumo do teste gratuito atingido. Cadastre uma chave própria de IA (BYOK) ou assine um plano para liberar acesso ilimitado.');
                }
            }
        }
        if (method === 'POST' && url.includes('/users')) {
            const usersCount = await this.prisma.user.count({ where: { tenantId } });
            if (isStarter && usersCount >= 3) {
                throw new common_1.ForbiddenException('Limite de usuários (3) excedido no plano STARTER.');
            }
            if (isGrowth && usersCount >= 10) {
                throw new common_1.ForbiddenException('Limite de usuários (10) excedido no plano GROWTH.');
            }
        }
        if (method === 'POST' && url.match(/\/chats\/[^/]+\/draft/)) {
            if (isStarter && billingStatus !== 'TRIAL') {
                throw new common_1.ForbiddenException('Recurso Indisponível: O plano STARTER não possui acesso à geração de rascunhos com IA.');
            }
            if (!hasByok) {
                const draftsQuota = isStarter ? 1500 : isGrowth ? 5000 : 999999;
                if (tenant.aiDraftsProcessedThisMonth >= draftsQuota) {
                    throw new common_1.ForbiddenException('Limite de rascunhos de IA mensal excedido. Configure sua própria chave (BYOK) ou faça upgrade do plano.');
                }
            }
        }
        return true;
    }
};
exports.BillingGuard = BillingGuard;
exports.BillingGuard = BillingGuard = BillingGuard_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], BillingGuard);
//# sourceMappingURL=billing.guard.js.map