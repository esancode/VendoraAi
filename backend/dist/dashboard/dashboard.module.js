"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DashboardModule = void 0;
const common_1 = require("@nestjs/common");
const dashboard_controller_1 = require("./dashboard.controller");
const auth_module_1 = require("../auth/auth.module");
const prisma_module_1 = require("../prisma/prisma.module");
const bullmq_1 = require("@nestjs/bullmq");
const retroactive_audit_processor_1 = require("./retroactive-audit.processor");
const intelligence_module_1 = require("../intelligence/intelligence.module");
const notifications_module_1 = require("../notifications/notifications.module");
let DashboardModule = class DashboardModule {
};
exports.DashboardModule = DashboardModule;
exports.DashboardModule = DashboardModule = __decorate([
    (0, common_1.Module)({
        imports: [
            auth_module_1.AuthModule,
            prisma_module_1.PrismaModule,
            intelligence_module_1.IntelligenceModule,
            notifications_module_1.NotificationsModule,
            bullmq_1.BullModule.registerQueue({
                name: 'retroactive-audit',
            }),
        ],
        controllers: [dashboard_controller_1.DashboardController],
        providers: [retroactive_audit_processor_1.RetroactiveAuditProcessor],
    })
], DashboardModule);
//# sourceMappingURL=dashboard.module.js.map