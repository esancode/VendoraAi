import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  async sendVerificationCode(email: string, code: string): Promise<void> {
    this.logger.log(`[MAIL MOCK] Sending verification code ${code} to ${email}`);
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  async sendPasswordResetLink(email: string, resetToken: string): Promise<void> {
    const resetUrl = `http://localhost:5173/reset-password?token=${resetToken}`;
    this.logger.log(`[MAIL MOCK] Sending password reset link to ${email}: ${resetUrl}`);
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  async sendSecurityAlertLocked(email: string): Promise<void> {
    this.logger.warn(`[MAIL MOCK] Sending security alert to ${email}: Account locked due to too many failed login attempts.`);
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  async sendRecoveryCode(email: string, code: string): Promise<void> {
    this.logger.log(`\n\n==============================================\n[MAIL MOCK] Password Recovery Code for ${email}:\n>>> ${code} <<<\n==============================================\n`);
    await new Promise(resolve => setTimeout(resolve, 500));
  }
}
