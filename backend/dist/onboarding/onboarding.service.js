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
var OnboardingService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.OnboardingService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const knowledge_service_1 = require("../intelligence/knowledge.service");
let OnboardingService = OnboardingService_1 = class OnboardingService {
    prisma;
    knowledgeService;
    logger = new common_1.Logger(OnboardingService_1.name);
    constructor(prisma, knowledgeService) {
        this.prisma = prisma;
        this.knowledgeService = knowledgeService;
    }
    async processOnboardingData(tenantId, userId, data) {
        const { niche, businessHours, shippingRules, paymentMethods, faqs } = data;
        let agent = await this.prisma.agent.findFirst({ where: { tenantId } });
        if (!agent) {
            agent = await this.prisma.agent.create({
                data: {
                    tenantId,
                    name: `Agente Comercial - ${niche || 'Geral'}`,
                    onboardingAnswers: data,
                    basePrompt: `Você é um agente comercial para o nicho de ${niche}. Responda de forma profissional e direta.`,
                }
            });
        }
        else {
            await this.prisma.agent.update({
                where: { id: agent.id },
                data: { onboardingAnswers: data }
            });
        }
        const combinedContent = `
Horário Comercial: ${JSON.stringify(businessHours)}
Políticas de Envio e Frete: ${shippingRules}
Formas de Pagamento: ${paymentMethods}
FAQs: ${JSON.stringify(faqs)}
`;
        await this.knowledgeService.createSource(tenantId, agent.id, 'Regras de Negócio Iniciais (Onboarding)', combinedContent);
        await this.prisma.tenant.update({
            where: { id: tenantId },
            data: { onboardingCompleted: true }
        });
        return { success: true, message: 'Onboarding completed and knowledge vectorised.' };
    }
};
exports.OnboardingService = OnboardingService;
exports.OnboardingService = OnboardingService = OnboardingService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        knowledge_service_1.KnowledgeService])
], OnboardingService);
//# sourceMappingURL=onboarding.service.js.map