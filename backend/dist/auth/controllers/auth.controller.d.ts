import { AuthService } from '../services/auth.service';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { ConfigService } from '@nestjs/config';
export declare class AuthController {
    private readonly authService;
    private readonly configService;
    constructor(authService: AuthService, configService: ConfigService);
    login(body: any, req: FastifyRequest & {
        ip: string;
    }, res: FastifyReply): Promise<{
        accessToken: string;
        user: any;
        tenantId: string;
    }>;
    register(body: any): Promise<{
        message: string;
    }>;
    verifyCode(body: any, res: FastifyReply): Promise<{
        accessToken: string;
        user: {
            id: string;
            name: string;
            role: string;
        };
        tenantId: string;
    }>;
    forgotPassword(body: {
        email: string;
    }): Promise<{
        message: string;
    }>;
    verifyRecoveryCode(body: {
        email: string;
        code: string;
    }): Promise<{
        resetToken: string;
        message: string;
    }>;
    resetPassword(body: {
        token: string;
        password_raw: string;
    }): Promise<{
        message: string;
    }>;
    googleAuth(): Promise<{
        url: string;
        statusCode: number;
    }>;
    googleAuthRedirect(req: any, res: FastifyReply): Promise<{
        url: string;
        statusCode: number;
    }>;
    refresh(req: FastifyRequest, res: FastifyReply): Promise<{
        accessToken: string;
        user: {
            id: string;
            name: string;
            role: string;
        };
        tenantId: string;
    }>;
    getMe(req: FastifyRequest): Promise<{
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
    logout(req: FastifyRequest, res: FastifyReply): Promise<void>;
    private setRefreshTokenCookie;
}
