"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var GuardrailService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.GuardrailService = void 0;
const common_1 = require("@nestjs/common");
let GuardrailService = GuardrailService_1 = class GuardrailService {
    logger = new common_1.Logger(GuardrailService_1.name);
    unmappedVarRegex = /\{.*?\}|\[(?!.*_MASKED_).*?\]/g;
    linkRegex = /https?:\/\/[^\s]+/g;
    validateDraft(draft) {
        if (!draft)
            return false;
        const varMatches = draft.match(this.unmappedVarRegex);
        if (varMatches && varMatches.length > 0) {
            this.logger.warn(`Guardrail bloqueou resposta devido a vazamento de variável/template: ${varMatches.join(', ')}`);
            return false;
        }
        const linkMatches = draft.match(this.linkRegex);
        if (linkMatches && linkMatches.length > 0) {
            this.logger.warn(`Guardrail bloqueou resposta devido a link externo detectado: ${linkMatches.join(', ')}`);
            return false;
        }
        return true;
    }
};
exports.GuardrailService = GuardrailService;
exports.GuardrailService = GuardrailService = GuardrailService_1 = __decorate([
    (0, common_1.Injectable)()
], GuardrailService);
//# sourceMappingURL=guardrail.service.js.map