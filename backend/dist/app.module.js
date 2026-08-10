"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
const common_1 = require("@nestjs/common");
const app_controller_1 = require("./app.controller");
const app_service_1 = require("./app.service");
const prisma_module_1 = require("./prisma/prisma.module");
const auth_module_1 = require("./auth/auth.module");
const common_module_1 = require("./common/common.module");
const bullmq_1 = require("@nestjs/bullmq");
const webhooks_module_1 = require("./webhooks/webhooks.module");
const intelligence_module_1 = require("./intelligence/intelligence.module");
const sla_module_1 = require("./sla/sla.module");
const notifications_module_1 = require("./notifications/notifications.module");
const agent_module_1 = require("./agent/agent.module");
const whatsapp_module_1 = require("./whatsapp/whatsapp.module");
const reports_module_1 = require("./reports/reports.module");
const dashboard_module_1 = require("./dashboard/dashboard.module");
const leads_module_1 = require("./leads/leads.module");
const onboarding_module_1 = require("./onboarding/onboarding.module");
const billing_module_1 = require("./billing/billing.module");
const billing_guard_1 = require("./common/guards/billing.guard");
const core_1 = require("@nestjs/core");
const schedule_1 = require("@nestjs/schedule");
const chats_module_1 = require("./chats/chats.module");
let AppModule = class AppModule {
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [
            prisma_module_1.PrismaModule,
            common_module_1.CommonModule,
            auth_module_1.AuthModule,
            schedule_1.ScheduleModule.forRoot(),
            bullmq_1.BullModule.forRoot({
                connection: {
                    host: process.env.REDIS_HOST || 'localhost',
                    port: parseInt(process.env.REDIS_PORT || '6379', 10),
                    db: 1,
                },
            }),
            webhooks_module_1.WebhooksModule,
            intelligence_module_1.IntelligenceModule,
            sla_module_1.SlaModule,
            notifications_module_1.NotificationsModule,
            agent_module_1.AgentModule,
            whatsapp_module_1.WhatsappModule,
            reports_module_1.ReportsModule,
            dashboard_module_1.DashboardModule,
            leads_module_1.LeadsModule,
            onboarding_module_1.OnboardingModule,
            billing_module_1.BillingModule,
            chats_module_1.ChatsModule,
        ],
        controllers: [app_controller_1.AppController],
        providers: [
            app_service_1.AppService,
            {
                provide: core_1.APP_GUARD,
                useClass: billing_guard_1.BillingGuard,
            },
        ],
    })
], AppModule);
//# sourceMappingURL=app.module.js.map