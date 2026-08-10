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
var ChatsController_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChatsController = void 0;
const common_1 = require("@nestjs/common");
const jwt_auth_guard_1 = require("../auth/guards/jwt-auth.guard");
const chats_service_1 = require("./chats.service");
let ChatsController = ChatsController_1 = class ChatsController {
    chatsService;
    logger = new common_1.Logger(ChatsController_1.name);
    constructor(chatsService) {
        this.chatsService = chatsService;
    }
    async getActiveChats(req) {
        const tenantId = req.tenantContext.tenantId;
        return await this.chatsService.getActiveChats(tenantId);
    }
    async getMessages(req, leadId) {
        const tenantId = req.tenantContext.tenantId;
        return await this.chatsService.getMessages(tenantId, leadId);
    }
    async generateDraft(req, leadId) {
        const tenantId = req.tenantContext.tenantId;
        return await this.chatsService.generateDraft(tenantId, leadId);
    }
};
exports.ChatsController = ChatsController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ChatsController.prototype, "getActiveChats", null);
__decorate([
    (0, common_1.Get)(':id/messages'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], ChatsController.prototype, "getMessages", null);
__decorate([
    (0, common_1.Post)(':id/draft'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], ChatsController.prototype, "generateDraft", null);
exports.ChatsController = ChatsController = ChatsController_1 = __decorate([
    (0, common_1.Controller)('api/v1/chats'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    __metadata("design:paramtypes", [chats_service_1.ChatsService])
], ChatsController);
//# sourceMappingURL=chats.controller.js.map