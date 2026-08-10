"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.IntelligenceModule = void 0;
const common_1 = require("@nestjs/common");
const ai_orchestrator_service_1 = require("./ai-orchestrator.service");
const intelligence_pipeline_processor_1 = require("./intelligence-pipeline.processor");
const security_module_1 = require("../security/security.module");
const notifications_module_1 = require("../notifications/notifications.module");
const bullmq_1 = require("@nestjs/bullmq");
const knowledge_service_1 = require("./knowledge.service");
const knowledge_controller_1 = require("./knowledge.controller");
const sessao_inatividade_service_1 = require("./sessao-inatividade.service");
const intelligence_service_1 = require("./intelligence.service");
const auth_module_1 = require("../auth/auth.module");
let IntelligenceModule = class IntelligenceModule {
};
exports.IntelligenceModule = IntelligenceModule;
exports.IntelligenceModule = IntelligenceModule = __decorate([
    (0, common_1.Module)({
        imports: [
            security_module_1.SecurityModule,
            notifications_module_1.NotificationsModule,
            auth_module_1.AuthModule,
            bullmq_1.BullModule.registerQueue({ name: 'whatsapp-outbound' }),
        ],
        providers: [ai_orchestrator_service_1.AiOrchestratorService, intelligence_pipeline_processor_1.IntelligencePipelineProcessor, knowledge_service_1.KnowledgeService, sessao_inatividade_service_1.SessaoInatividadeService, intelligence_service_1.IntelligenceService],
        controllers: [knowledge_controller_1.KnowledgeController],
        exports: [ai_orchestrator_service_1.AiOrchestratorService, knowledge_service_1.KnowledgeService, intelligence_service_1.IntelligenceService],
    })
], IntelligenceModule);
//# sourceMappingURL=intelligence.module.js.map