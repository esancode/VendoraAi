"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var MailService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.MailService = void 0;
const common_1 = require("@nestjs/common");
let MailService = MailService_1 = class MailService {
    logger = new common_1.Logger(MailService_1.name);
    async sendVerificationCode(email, code) {
        this.logger.log(`[MAIL MOCK] Sending verification code ${code} to ${email}`);
        await new Promise(resolve => setTimeout(resolve, 500));
    }
    async sendPasswordResetLink(email, resetToken) {
        const resetUrl = `http://localhost:5173/reset-password?token=${resetToken}`;
        this.logger.log(`[MAIL MOCK] Sending password reset link to ${email}: ${resetUrl}`);
        await new Promise(resolve => setTimeout(resolve, 500));
    }
    async sendSecurityAlertLocked(email) {
        this.logger.warn(`[MAIL MOCK] Sending security alert to ${email}: Account locked due to too many failed login attempts.`);
        await new Promise(resolve => setTimeout(resolve, 500));
    }
    async sendRecoveryCode(email, code) {
        this.logger.log(`\n\n==============================================\n[MAIL MOCK] Password Recovery Code for ${email}:\n>>> ${code} <<<\n==============================================\n`);
        await new Promise(resolve => setTimeout(resolve, 500));
    }
};
exports.MailService = MailService;
exports.MailService = MailService = MailService_1 = __decorate([
    (0, common_1.Injectable)()
], MailService);
//# sourceMappingURL=mail.service.js.map