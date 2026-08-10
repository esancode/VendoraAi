import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../prisma/prisma.service';
import { PasswordHasherService } from './password-hasher.service';
import { RedisService } from '../../common/services/redis.service';
import { MailService } from '../../common/services/mail.service';
export interface AuthResponse {
    accessToken: string;
}
export declare class AuthService {
    private readonly prisma;
    private readonly jwtService;
    private readonly passwordHasher;
    private readonly redisService;
    private readonly mailService;
    private readonly logger;
    constructor(prisma: PrismaService, jwtService: JwtService, passwordHasher: PasswordHasherService, redisService: RedisService, mailService: MailService);
    login(email: string, password_raw: string, ip?: string): Promise<{
        accessToken: string;
        refreshToken: string;
        user: any;
        tenantId: string;
    }>;
    register(data: any): Promise<{
        message: string;
    }>;
    googleLogin(profile: any): Promise<{
        accessToken: string;
        refreshToken: string;
        user: any;
        tenantId: string;
    }>;
    verifyCode(email: string, code: string): Promise<{
        accessToken: string;
        refreshToken: string;
        user: {
            id: string;
            name: string;
            role: string;
        };
        tenantId: string;
    }>;
    forgotPassword(email: string): Promise<{
        message: string;
    }>;
    verifyRecoveryCode(email: string, code: string): Promise<{
        resetToken: string;
        message: string;
    }>;
    resetPassword(token: string, newPasswordRaw: string): Promise<{
        message: string;
    }>;
    refreshSession(refreshToken: string): Promise<{
        accessToken: string;
        refreshToken: string;
        user: {
            id: string;
            name: string;
            role: string;
        };
        tenantId: string;
    }>;
    getMe(userId: string): Promise<{
        tenant: {
            name: string;
            onboardingCompleted: boolean;
            plan: import("@prisma/client").$Enums.SaasPlan;
            billingStatus: import("@prisma/client").$Enums.BillingStatus;
            trialEndsAt: Date | null;
        };
        id: string;
        email: string;
        name: string;
        role: import("@prisma/client").$Enums.UserRole;
        tenantId: string;
        status: import("@prisma/client").$Enums.UserStatus;
        avatarUrl: string | null;
    }>;
    logout(userId: string, tenantId: string, refreshToken: string): Promise<void>;
    private generateTokensExt;
    private hashToken;
}
