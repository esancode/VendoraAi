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
exports.LeadsController = void 0;
const common_1 = require("@nestjs/common");
const jwt_auth_guard_1 = require("../auth/guards/jwt-auth.guard");
const prisma_service_1 = require("../prisma/prisma.service");
let LeadsController = class LeadsController {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async getPriorityLeads(req, agentId) {
        const tenantId = req.tenantContext.tenantId;
        const leads = await this.prisma.lead.findMany({
            where: {
                tenantId,
                status: 'ACTIVE',
                ...(agentId ? {
                    conversations: {
                        some: {
                            status: 'OPEN',
                            agentId: agentId,
                        }
                    }
                } : {})
            },
            orderBy: {
                slaLimitAt: 'asc',
            },
            take: 5,
        });
        return leads.map(lead => ({
            id: lead.id,
            name: lead.name,
            status: lead.status,
            createdAt: lead.createdAt,
            slaLimitAt: lead.slaLimitAt,
            lastMessage: lead.conversationalSummary || 'Nenhuma conversa registrada ainda.',
        }));
    }
};
exports.LeadsController = LeadsController;
__decorate([
    (0, common_1.Get)('priority'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)('agentId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], LeadsController.prototype, "getPriorityLeads", null);
exports.LeadsController = LeadsController = __decorate([
    (0, common_1.Controller)('api/v1/leads'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], LeadsController);
//# sourceMappingURL=leads.controller.js.map