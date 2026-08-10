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
var BillingService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.BillingService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
let BillingService = BillingService_1 = class BillingService {
    prisma;
    logger = new common_1.Logger(BillingService_1.name);
    asaasApiUrl = process.env.ASAAS_API_URL || 'https://sandbox.asaas.com/api/v3';
    asaasApiKey = process.env.ASAAS_API_KEY;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async createCheckoutLink(tenantId, plan) {
        if (!this.asaasApiKey) {
            this.logger.warn('ASAAS_API_KEY não configurada. Simulando link de pagamento para ambiente de dev.');
            return {
                paymentLinkUrl: `https://sandbox.asaas.com/paymentLink/simulation?plan=${plan}&tenantId=${tenantId}`
            };
        }
        const tenant = await this.prisma.tenant.findUnique({
            where: { id: tenantId },
            include: { users: { where: { role: 'ADMIN' }, take: 1 } }
        });
        if (!tenant)
            throw new common_1.InternalServerErrorException('Tenant não encontrado');
        const admin = tenant.users[0];
        let price = 0;
        if (plan === 'GROWTH')
            price = 299.00;
        else if (plan === 'ENTERPRISE')
            price = 999.00;
        else
            price = 0;
        try {
            const response = await fetch(`${this.asaasApiUrl}/paymentLinks`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'access_token': this.asaasApiKey
                },
                body: JSON.stringify({
                    name: `Assinatura VendoraAI - Plano ${plan}`,
                    value: price,
                    chargeType: 'RECURRENT',
                    subscriptionCycle: 'MONTHLY',
                    billingType: 'UNDEFINED'
                })
            });
            const data = await response.json();
            if (!response.ok) {
                this.logger.error(`Erro ao criar link de pagamento no Asaas: ${JSON.stringify(data)}`);
                throw new common_1.InternalServerErrorException('Erro ao se comunicar com gateway de pagamento');
            }
            return {
                paymentLinkUrl: data.url
            };
        }
        catch (error) {
            this.logger.error(`Exceção ao criar link Asaas: ${error}`);
            throw new common_1.InternalServerErrorException('Erro interno ao gerar checkout');
        }
    }
};
exports.BillingService = BillingService;
exports.BillingService = BillingService = BillingService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], BillingService);
//# sourceMappingURL=billing.service.js.map