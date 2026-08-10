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
exports.AgentController = void 0;
const common_1 = require("@nestjs/common");
const agent_reply_service_1 = require("./agent-reply.service");
const agent_service_1 = require("./agent.service");
const jwt_auth_guard_1 = require("../auth/guards/jwt-auth.guard");
const zod_1 = require("zod");
const ReplySchema = zod_1.z.object({
    leadId: zod_1.z.string().uuid(),
    content: zod_1.z.string().min(1),
    tenantId: zod_1.z.string().uuid(),
    agentId: zod_1.z.string().uuid(),
});
let AgentController = class AgentController {
    agentReplyService;
    agentService;
    constructor(agentReplyService, agentService) {
        this.agentReplyService = agentReplyService;
        this.agentService = agentService;
    }
    async listAgents(req) {
        const tenantId = req.tenantContext.tenantId;
        return await this.agentService.listAgents(tenantId);
    }
    async getAgent(req, id) {
        const tenantId = req.tenantContext.tenantId;
        return await this.agentService.getAgent(tenantId, id);
    }
    async createAgent(req, body) {
        const tenantId = req.tenantContext.tenantId;
        return await this.agentService.createAgent(tenantId, body);
    }
    async updateAgent(req, id, body) {
        const tenantId = req.tenantContext.tenantId;
        return await this.agentService.updateAgent(tenantId, id, body);
    }
    async deleteAgent(req, id) {
        const tenantId = req.tenantContext.tenantId;
        return await this.agentService.deleteAgent(tenantId, id);
    }
    async listExamples(req, id) {
        const tenantId = req.tenantContext.tenantId;
        return await this.agentService.listExamples(tenantId, id);
    }
    async addExample(req, id, body) {
        const tenantId = req.tenantContext.tenantId;
        return await this.agentService.addExample(tenantId, id, body);
    }
    async deleteExample(req, id, exampleId) {
        const tenantId = req.tenantContext.tenantId;
        return await this.agentService.deleteExample(tenantId, exampleId);
    }
    async replyToLead(body) {
        const parsed = ReplySchema.safeParse(body);
        if (!parsed.success) {
            throw new common_1.UnauthorizedException('Invalid request body');
        }
        const { tenantId, leadId, content, agentId } = parsed.data;
        const message = await this.agentReplyService.handleAgentReply(tenantId, leadId, content, agentId);
        return { success: true, messageId: message.id };
    }
};
exports.AgentController = AgentController;
__decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Get)(),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AgentController.prototype, "listAgents", null);
__decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Get)(':id'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], AgentController.prototype, "getAgent", null);
__decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Post)(),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], AgentController.prototype, "createAgent", null);
__decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Put)(':id'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", Promise)
], AgentController.prototype, "updateAgent", null);
__decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Delete)(':id'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], AgentController.prototype, "deleteAgent", null);
__decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Get)(':id/examples'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], AgentController.prototype, "listExamples", null);
__decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Post)(':id/examples'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", Promise)
], AgentController.prototype, "addExample", null);
__decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Delete)(':id/examples/:exampleId'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Param)('exampleId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", Promise)
], AgentController.prototype, "deleteExample", null);
__decorate([
    (0, common_1.Post)('reply'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AgentController.prototype, "replyToLead", null);
exports.AgentController = AgentController = __decorate([
    (0, common_1.Controller)('api/v1/agents'),
    __metadata("design:paramtypes", [agent_reply_service_1.AgentReplyService,
        agent_service_1.AgentService])
], AgentController);
//# sourceMappingURL=agent.controller.js.map