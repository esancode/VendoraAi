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
exports.DashboardController = void 0;
const common_1 = require("@nestjs/common");
const jwt_auth_guard_1 = require("../auth/guards/jwt-auth.guard");
const prisma_service_1 = require("../prisma/prisma.service");
const bullmq_1 = require("@nestjs/bullmq");
const bullmq_2 = require("bullmq");
let DashboardController = class DashboardController {
    prisma;
    auditQueue;
    constructor(prisma, auditQueue) {
        this.prisma = prisma;
        this.auditQueue = auditQueue;
    }
    async getStatus(req) {
        const tenantId = req.tenantContext.tenantId;
        const tenant = await this.prisma.tenant.findUnique({
            where: { id: tenantId },
        });
        const connectedChannel = await this.prisma.whatsAppChannel.findFirst({
            where: { tenantId, connectionStatus: 'CONNECTED' },
        });
        const isChannelConnected = !!connectedChannel;
        const isDataAnalyzed = tenant?.onboardingCompleted || false;
        return {
            isChannelConnected,
            isDataAnalyzed,
            tenantStatus: {
                status: tenant?.billingStatus === 'TRIAL' ? 'trial_active' : tenant?.billingStatus === 'ACTIVE' ? 'active' : 'canceled',
                processedMessages: tenant?.messagesProcessedThisMonth || 0,
                onboardingCompleted: tenant?.onboardingCompleted,
            },
        };
    }
    async triggerAudit(req) {
        const tenantId = req.tenantContext.tenantId;
        const connectedChannel = await this.prisma.whatsAppChannel.findFirst({
            where: { tenantId, connectionStatus: 'CONNECTED' },
        });
        if (!connectedChannel) {
            throw new common_1.BadRequestException('Nenhum canal WhatsApp conectado para auditoria.');
        }
        await this.auditQueue.add('process-retroactive-audit', {
            tenantId,
            channelId: connectedChannel.id,
        });
        return { success: true, message: 'Auditoria retroativa iniciada no BullMQ.' };
    }
    async getNarrativeInsights(req) {
        const tenantId = req.tenantContext.tenantId;
        const avgSlaRaw = await this.prisma.conversation.aggregate({
            where: { tenantId, responseSlaSeconds: { not: null } },
            _avg: { responseSlaSeconds: true },
        });
        const avgSlaMinutes = avgSlaRaw._avg.responseSlaSeconds ? Math.round(avgSlaRaw._avg.responseSlaSeconds / 60) : 0;
        const objectionsRaw = await this.prisma.conversation.groupBy({
            by: ['lossReason'],
            where: { tenantId, lossReason: { not: null } },
            _count: { lossReason: true },
        });
        const totalLosses = objectionsRaw.reduce((acc, curr) => acc + curr._count.lossReason, 0);
        const topObjection = objectionsRaw.sort((a, b) => b._count.lossReason - a._count.lossReason)[0];
        const topLossReason = topObjection ? topObjection.lossReason : 'Nenhuma';
        const topLossPercentage = topObjection && totalLosses > 0 ? Math.round((topObjection._count.lossReason / totalLosses) * 100) : 0;
        const estimatedLossBrl = totalLosses * 500;
        const coolingLeads = await this.prisma.lead.count({
            where: { tenantId, status: 'COLD' },
        });
        const user = await this.prisma.user.findFirst({ where: { tenantId, role: 'ADMIN' } });
        return {
            managerName: user?.name || 'Gestor',
            avgSlaMinutes,
            coolingLeads,
            topLossReason,
            topLossPercentage,
            estimatedLossBrl
        };
    }
    async getObjections(req) {
        const tenantId = req.tenantContext.tenantId;
        const objectionsRaw = await this.prisma.conversation.groupBy({
            by: ['lossReason'],
            where: { tenantId, lossReason: { not: null } },
            _count: { lossReason: true },
        });
        const totalLosses = objectionsRaw.reduce((acc, curr) => acc + curr._count.lossReason, 0);
        return objectionsRaw.map(obj => ({
            category: obj.lossReason,
            percentage: totalLosses > 0 ? Math.round((obj._count.lossReason / totalLosses) * 100) : 0,
            estimatedLoss: obj._count.lossReason * 500
        })).sort((a, b) => b.percentage - a.percentage);
    }
    async getSlaBottlenecks(req) {
        return [
            { agentId: '1', agentName: 'Juliana Costa', avatarUrl: 'https://i.pravatar.cc/150?u=1', avgSlaFormatted: '08m 15s', coolingLeadsCount: 4, delayLossCount: 1 },
            { agentId: '2', agentName: 'Roberto Almeida', avatarUrl: 'https://i.pravatar.cc/150?u=2', avgSlaFormatted: '22m 40s', coolingLeadsCount: 12, delayLossCount: 5 },
        ];
    }
    async getUnmappedDemands(req) {
        const tenantId = req.tenantContext.tenantId;
        const conversations = await this.prisma.conversation.findMany({
            where: { tenantId, unmappedDemands: { isEmpty: false } },
            select: { unmappedDemands: true }
        });
        const demandCounts = {};
        for (const conv of conversations) {
            for (const demand of conv.unmappedDemands) {
                demandCounts[demand] = (demandCounts[demand] || 0) + 1;
            }
        }
        return Object.entries(demandCounts)
            .map(([term, count]) => ({ term, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 10);
    }
    async getStats(req) {
        const tenantId = req.tenantContext.tenantId;
        const openLeadsCount = await this.prisma.lead.count({
            where: { tenantId, status: 'ACTIVE' },
        });
        const breachingSlaCount = await this.prisma.lead.count({
            where: { tenantId, status: 'ACTIVE', slaLimitAt: { lt: new Date() } },
        });
        const avgSlaRaw = await this.prisma.conversation.aggregate({
            where: { tenantId, responseSlaSeconds: { not: null } },
            _avg: { responseSlaSeconds: true },
        });
        const avgSlaMinutes = avgSlaRaw._avg.responseSlaSeconds ? Math.round(avgSlaRaw._avg.responseSlaSeconds / 60) : 0;
        const objectionsRaw = await this.prisma.conversation.groupBy({
            by: ['lossReason'],
            where: { tenantId, lossReason: { not: null } },
            _count: { lossReason: true },
        });
        const topObjection = objectionsRaw.sort((a, b) => b._count.lossReason - a._count.lossReason)[0];
        return {
            openLeadsCount,
            avgSlaMinutes,
            breachingSlaCount,
            topLossReason: topObjection ? topObjection.lossReason : 'Nenhum dado',
        };
    }
};
exports.DashboardController = DashboardController;
__decorate([
    (0, common_1.Get)('status'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], DashboardController.prototype, "getStatus", null);
__decorate([
    (0, common_1.Post)('trigger-retroactive-audit'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], DashboardController.prototype, "triggerAudit", null);
__decorate([
    (0, common_1.Get)('narrative'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], DashboardController.prototype, "getNarrativeInsights", null);
__decorate([
    (0, common_1.Get)('objections'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], DashboardController.prototype, "getObjections", null);
__decorate([
    (0, common_1.Get)('slas'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], DashboardController.prototype, "getSlaBottlenecks", null);
__decorate([
    (0, common_1.Get)('unmapped-demands'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], DashboardController.prototype, "getUnmappedDemands", null);
__decorate([
    (0, common_1.Get)('stats'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], DashboardController.prototype, "getStats", null);
exports.DashboardController = DashboardController = __decorate([
    (0, common_1.Controller)('api/v1/dashboard'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    __param(1, (0, bullmq_1.InjectQueue)('retroactive-audit')),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        bullmq_2.Queue])
], DashboardController);
//# sourceMappingURL=dashboard.controller.js.map