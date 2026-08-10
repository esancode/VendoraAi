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
exports.ReportsController = void 0;
const common_1 = require("@nestjs/common");
const reports_service_1 = require("./reports.service");
const jwt_auth_guard_1 = require("../auth/guards/jwt-auth.guard");
let ReportsController = class ReportsController {
    reportsService;
    constructor(reportsService) {
        this.reportsService = reportsService;
    }
    async getWeeklyReport(req) {
        const tenantId = req.user.tenantId;
        const markdown = await this.reportsService.generateWeeklyReport(tenantId);
        return { report: markdown };
    }
    async downloadWeeklyReport(req, res) {
        const tenantId = req.user.tenantId;
        const markdown = await this.reportsService.generateWeeklyReport(tenantId);
        const pdfDoc = this.reportsService.generatePdfStream(markdown);
        res.header('Content-Type', 'application/pdf');
        res.header('Content-Disposition', 'attachment; filename=relatorio-semanal.pdf');
        res.send(pdfDoc);
    }
};
exports.ReportsController = ReportsController;
__decorate([
    (0, common_1.Get)('weekly'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ReportsController.prototype, "getWeeklyReport", null);
__decorate([
    (0, common_1.Get)('weekly/download'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ReportsController.prototype, "downloadWeeklyReport", null);
exports.ReportsController = ReportsController = __decorate([
    (0, common_1.Controller)('api/v1/reports'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    __metadata("design:paramtypes", [reports_service_1.ReportsService])
], ReportsController);
//# sourceMappingURL=reports.controller.js.map