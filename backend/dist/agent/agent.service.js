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
Object.defineProperty(exports, "__esModule", { value: true });
exports.AgentService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
let AgentService = class AgentService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async listAgents(tenantId) {
        return await this.prisma.runInTenantContext(tenantId, async (tx) => {
            const agents = await tx.agent.findMany({
                orderBy: { createdAt: 'desc' },
            });
            return agents.map(agent => {
                const answers = agent.onboardingAnswers || {};
                return {
                    ...agent,
                    tone: answers.tone,
                    maxDiscount: answers.maxDiscount,
                    refundPolicy: answers.refundPolicy,
                    useEmojis: answers.useEmojis,
                };
            });
        });
    }
    async getAgent(tenantId, agentId) {
        return await this.prisma.runInTenantContext(tenantId, async (tx) => {
            const agent = await tx.agent.findUnique({
                where: { id: agentId },
            });
            if (!agent)
                throw new common_1.NotFoundException('Agente não encontrado');
            const answers = agent.onboardingAnswers || {};
            return {
                ...agent,
                tone: answers.tone,
                maxDiscount: answers.maxDiscount,
                refundPolicy: answers.refundPolicy,
                useEmojis: answers.useEmojis,
            };
        });
    }
    async createAgent(tenantId, data) {
        return await this.prisma.runInTenantContext(tenantId, async (tx) => {
            const onboardingAnswers = {
                tone: data.tone,
                maxDiscount: data.maxDiscount,
                refundPolicy: data.refundPolicy,
                useEmojis: data.useEmojis,
            };
            const agent = await tx.agent.create({
                data: {
                    tenantId,
                    name: data.name || 'Assistente Virtual',
                    onboardingAnswers,
                    basePrompt: data.basePrompt || null,
                    temperature: data.temperature ?? 0.7,
                },
            });
            return agent;
        });
    }
    async updateAgent(tenantId, agentId, data) {
        return await this.prisma.runInTenantContext(tenantId, async (tx) => {
            const agentExists = await tx.agent.findUnique({ where: { id: agentId } });
            if (!agentExists)
                throw new common_1.NotFoundException('Agente não encontrado');
            const onboardingAnswers = {
                tone: data.tone,
                maxDiscount: data.maxDiscount,
                refundPolicy: data.refundPolicy,
                useEmojis: data.useEmojis,
            };
            const agent = await tx.agent.update({
                where: { id: agentId },
                data: {
                    name: data.name,
                    onboardingAnswers,
                    basePrompt: data.basePrompt,
                    temperature: data.temperature,
                    status: data.status,
                },
            });
            return agent;
        });
    }
    async deleteAgent(tenantId, agentId) {
        return await this.prisma.runInTenantContext(tenantId, async (tx) => {
            const agentExists = await tx.agent.findUnique({ where: { id: agentId } });
            if (!agentExists)
                throw new common_1.NotFoundException('Agente não encontrado');
            return await tx.agent.delete({
                where: { id: agentId },
            });
        });
    }
    async listExamples(tenantId, agentId) {
        return await this.prisma.runInTenantContext(tenantId, async (tx) => {
            return await tx.agentExample.findMany({
                where: { agentId },
                orderBy: { createdAt: 'desc' },
            });
        });
    }
    async addExample(tenantId, agentId, data) {
        return await this.prisma.runInTenantContext(tenantId, async (tx) => {
            const agent = await tx.agent.findUnique({
                where: { id: agentId },
            });
            if (!agent) {
                throw new common_1.NotFoundException('Agente não encontrado');
            }
            return await tx.agentExample.create({
                data: {
                    tenantId,
                    agentId: agent.id,
                    userQuery: data.userQuery,
                    expectedResponse: data.expectedResponse,
                },
            });
        });
    }
    async deleteExample(tenantId, exampleId) {
        return await this.prisma.runInTenantContext(tenantId, async (tx) => {
            const example = await tx.agentExample.findUnique({
                where: { id: exampleId },
            });
            if (!example || example.tenantId !== tenantId) {
                throw new common_1.NotFoundException('Exemplo não encontrado ou acesso negado');
            }
            return await tx.agentExample.delete({
                where: { id: exampleId },
            });
        });
    }
};
exports.AgentService = AgentService;
exports.AgentService = AgentService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], AgentService);
//# sourceMappingURL=agent.service.js.map