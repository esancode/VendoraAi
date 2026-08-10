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
exports.KnowledgeController = void 0;
const common_1 = require("@nestjs/common");
const jwt_auth_guard_1 = require("../auth/guards/jwt-auth.guard");
const knowledge_service_1 = require("./knowledge.service");
const prisma_service_1 = require("../prisma/prisma.service");
let KnowledgeController = class KnowledgeController {
    knowledgeService;
    prisma;
    constructor(knowledgeService, prisma) {
        this.knowledgeService = knowledgeService;
        this.prisma = prisma;
    }
    async getKnowledgeSources(req, agentId) {
        const tenantId = req.tenantContext.tenantId;
        const sources = await this.prisma.knowledgeSource.findMany({
            where: { tenantId, agentId },
            orderBy: { updatedAt: 'desc' },
            select: {
                id: true,
                title: true,
                content: true,
                updatedAt: true,
            },
        });
        return sources.map((s) => ({
            ...s,
            status: 'COMPLETED',
            chunkCount: 1,
        }));
    }
    async createKnowledgeSource(req, body) {
        const tenantId = req.tenantContext.tenantId;
        const { title, content, agentId } = body;
        await this.knowledgeService.createSource(tenantId, agentId, title, content);
        return { success: true };
    }
    async deleteKnowledgeSource(req, id, agentId) {
        const tenantId = req.tenantContext.tenantId;
        await this.knowledgeService.deleteSource(tenantId, agentId, id);
        return { success: true };
    }
};
exports.KnowledgeController = KnowledgeController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)('agentId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], KnowledgeController.prototype, "getKnowledgeSources", null);
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], KnowledgeController.prototype, "createKnowledgeSource", null);
__decorate([
    (0, common_1.Delete)(':id'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Query)('agentId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", Promise)
], KnowledgeController.prototype, "deleteKnowledgeSource", null);
exports.KnowledgeController = KnowledgeController = __decorate([
    (0, common_1.Controller)('api/v1/knowledge-sources'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    __metadata("design:paramtypes", [knowledge_service_1.KnowledgeService,
        prisma_service_1.PrismaService])
], KnowledgeController);
//# sourceMappingURL=knowledge.controller.js.map