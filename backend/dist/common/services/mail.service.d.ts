export declare class MailService {
    private readonly logger;
    sendVerificationCode(email: string, code: string): Promise<void>;
    sendPasswordResetLink(email: string, resetToken: string): Promise<void>;
    sendSecurityAlertLocked(email: string): Promise<void>;
    sendRecoveryCode(email: string, code: string): Promise<void>;
}
