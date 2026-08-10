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
var AuthService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const common_1 = require("@nestjs/common");
const jwt_1 = require("@nestjs/jwt");
const prisma_service_1 = require("../../prisma/prisma.service");
const password_hasher_service_1 = require("./password-hasher.service");
const redis_service_1 = require("../../common/services/redis.service");
const mail_service_1 = require("../../common/services/mail.service");
const crypto_1 = require("crypto");
const client_1 = require("@prisma/client");
let AuthService = AuthService_1 = class AuthService {
    prisma;
    jwtService;
    passwordHasher;
    redisService;
    mailService;
    logger = new common_1.Logger(AuthService_1.name);
    constructor(prisma, jwtService, passwordHasher, redisService, mailService) {
        this.prisma = prisma;
        this.jwtService = jwtService;
        this.passwordHasher = passwordHasher;
        this.redisService = redisService;
        this.mailService = mailService;
    }
    async login(email, password_raw, ip = '127.0.0.1') {
        email = email.toLowerCase().trim();
        const redisClient = this.redisService.getClient();
        const rateLimitKey = `ratelimit:login:${email}:${ip}`;
        const attempts = await redisClient.incr(rateLimitKey);
        if (attempts === 1) {
            await redisClient.expire(rateLimitKey, 900);
        }
        if (attempts > 5) {
            throw new common_1.HttpException('Too Many Requests', common_1.HttpStatus.TOO_MANY_REQUESTS);
        }
        const user = await this.prisma.user.findUnique({
            where: { email },
            include: { tenant: true },
        });
        if (!user) {
            throw new common_1.UnauthorizedException('Credenciais inválidas');
        }
        if (user.status === 'LOCKED') {
            throw new common_1.UnauthorizedException('Conta bloqueada por segurança. Redefina sua senha.');
        }
        if (user.status === 'PENDING_VERIFICATION') {
            throw new common_1.UnauthorizedException('Conta pendente de verificação.');
        }
        const isValid = await this.passwordHasher.compare(user.passwordHash, password_raw);
        if (!isValid) {
            const lockKey = `lock:account:${email}`;
            const failCount = await redisClient.incr(lockKey);
            if (failCount === 1) {
                await redisClient.expire(lockKey, 1800);
            }
            if (failCount >= 10) {
                await this.prisma.user.update({ where: { email }, data: { status: 'LOCKED' } });
                await this.mailService.sendSecurityAlertLocked(email);
                await redisClient.del(lockKey);
            }
            throw new common_1.UnauthorizedException('Credenciais inválidas');
        }
        await redisClient.del(rateLimitKey);
        await redisClient.del(`lock:account:${email}`);
        return this.generateTokensExt(user.id, user.tenantId, user.role, user.name);
    }
    async register(data) {
        let { companyName, adminName, adminEmail, password } = data;
        adminEmail = adminEmail.toLowerCase().trim();
        const existingUser = await this.prisma.user.findUnique({
            where: { email: adminEmail },
        });
        if (existingUser) {
            throw new common_1.UnauthorizedException('E-mail já está em uso.');
        }
        const passwordHash = await this.passwordHasher.hash(password);
        await this.prisma.$transaction(async (prisma) => {
            const tenant = await prisma.tenant.create({
                data: {
                    name: companyName,
                    plan: 'STARTER',
                    billingStatus: 'TRIAL',
                    trialEndsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
                    messagesProcessedThisMonth: 0,
                    aiDraftsProcessedThisMonth: 0,
                },
            });
            await prisma.user.create({
                data: {
                    name: adminName,
                    email: adminEmail,
                    passwordHash,
                    role: 'ADMIN',
                    tenantId: tenant.id,
                    status: 'PENDING_VERIFICATION',
                },
            });
        });
        const code = Math.floor(100000 + Math.random() * 900000).toString();
        const redisClient = this.redisService.getClient();
        await redisClient.set(`verification:code:${adminEmail}`, code, 'EX', 600);
        await this.mailService.sendVerificationCode(adminEmail, code);
        return { message: 'Código de verificação enviado para o e-mail.' };
    }
    async googleLogin(profile) {
        const { email, fullName, avatarUrl } = profile;
        const redisClient = this.redisService.getClient();
        let user = await this.prisma.user.findUnique({
            where: { email },
            include: { tenant: true },
        });
        if (!user) {
            user = await this.prisma.$transaction(async (prisma) => {
                const tenant = await prisma.tenant.create({
                    data: {
                        name: `Empresa de ${fullName}`,
                        onboardingCompleted: false,
                        plan: 'STARTER',
                        billingStatus: 'TRIAL',
                        trialEndsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
                        messagesProcessedThisMonth: 0,
                        aiDraftsProcessedThisMonth: 0,
                    },
                });
                return await prisma.user.create({
                    data: {
                        email,
                        name: fullName,
                        passwordHash: 'oauth_managed',
                        avatarUrl,
                        role: client_1.UserRole.ADMIN,
                        tenantId: tenant.id,
                        status: 'ACTIVE',
                    },
                    include: { tenant: true },
                });
            });
        }
        else {
            if (avatarUrl && user.avatarUrl !== avatarUrl) {
                user = await this.prisma.user.update({
                    where: { id: user.id },
                    data: { avatarUrl },
                    include: { tenant: true }
                });
            }
            if (user.status === 'LOCKED') {
                throw new common_1.UnauthorizedException('Conta bloqueada por segurança.');
            }
            if (user.status === 'PENDING_VERIFICATION') {
                user = await this.prisma.user.update({
                    where: { id: user.id },
                    data: { status: 'ACTIVE' },
                    include: { tenant: true }
                });
            }
        }
        return this.generateTokensExt(user.id, user.tenantId, user.role, user.name);
    }
    async verifyCode(email, code) {
        email = email.toLowerCase().trim();
        const redisClient = this.redisService.getClient();
        const savedCode = await redisClient.get(`verification:code:${email}`);
        if (!savedCode || savedCode !== code) {
            throw new common_1.UnauthorizedException('Código inválido ou expirado');
        }
        const user = await this.prisma.user.update({
            where: { email },
            data: { status: 'ACTIVE' },
        });
        await redisClient.del(`verification:code:${email}`);
        return this.generateTokensExt(user.id, user.tenantId, user.role, user.name);
    }
    async forgotPassword(email) {
        email = email.toLowerCase().trim();
        const user = await this.prisma.user.findUnique({ where: { email } });
        if (!user)
            return { message: 'Se o e-mail existir, um código de recuperação foi enviado.' };
        const code = Math.floor(100000 + Math.random() * 900000).toString();
        const redisClient = this.redisService.getClient();
        await redisClient.set(`recovery:${email}`, code, 'EX', 600);
        await this.mailService.sendRecoveryCode(email, code);
        return { message: 'Se o e-mail existir, um código de recuperação foi enviado.' };
    }
    async verifyRecoveryCode(email, code) {
        email = email.toLowerCase().trim();
        const redisClient = this.redisService.getClient();
        const savedCode = await redisClient.get(`recovery:${email}`);
        if (!savedCode || savedCode !== code) {
            throw new common_1.UnauthorizedException('Código inválido ou expirado');
        }
        const resetToken = (0, crypto_1.randomBytes)(32).toString('hex');
        await redisClient.set(`reset:token:${resetToken}`, email, 'EX', 300);
        await redisClient.del(`recovery:${email}`);
        return { resetToken, message: 'Código verificado com sucesso.' };
    }
    async resetPassword(token, newPasswordRaw) {
        const redisClient = this.redisService.getClient();
        const email = await redisClient.get(`reset:token:${token}`);
        if (!email) {
            throw new common_1.UnauthorizedException('Sessão de recuperação expirada. Tente novamente.');
        }
        const passwordHash = await this.passwordHasher.hash(newPasswordRaw);
        await this.prisma.user.update({
            where: { email },
            data: { passwordHash, status: 'ACTIVE' },
        });
        await redisClient.del(`reset:token:${token}`);
        return { message: 'Senha atualizada com sucesso' };
    }
    async refreshSession(refreshToken) {
        if (!refreshToken) {
            throw new common_1.UnauthorizedException('Refresh token ausente');
        }
        const tokenHash = this.hashToken(refreshToken);
        const redisClient = this.redisService.getClient();
        const parts = refreshToken.split('.');
        if (parts.length !== 3) {
            throw new common_1.UnauthorizedException('Formato de token inválido');
        }
        const [userId, tenantId, randomString] = parts;
        const sessionKey = `tenant:${tenantId}:session:${userId}:${tokenHash}`;
        const sessionData = await redisClient.get(sessionKey);
        if (!sessionData) {
            this.logger.warn(`Tentativa de uso de Refresh Token inválido/revogado. Revogando todas as sessões do usuário ${userId}`);
            const keys = await redisClient.keys(`tenant:${tenantId}:session:${userId}:*`);
            if (keys.length > 0) {
                await redisClient.del(...keys);
            }
            throw new common_1.UnauthorizedException('Sessão revogada ou expirada');
        }
        await redisClient.del(sessionKey);
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
        });
        if (!user || user.tenantId !== tenantId || user.status !== 'ACTIVE') {
            throw new common_1.UnauthorizedException('Usuário inválido ou bloqueado');
        }
        return this.generateTokensExt(user.id, user.tenantId, user.role, user.name);
    }
    async getMe(userId) {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                name: true,
                email: true,
                role: true,
                tenantId: true,
                avatarUrl: true,
                status: true,
                tenant: {
                    select: {
                        onboardingCompleted: true,
                        name: true,
                        plan: true,
                        billingStatus: true,
                        trialEndsAt: true,
                    }
                }
            }
        });
        if (!user)
            throw new common_1.UnauthorizedException('User not found');
        return user;
    }
    async logout(userId, tenantId, refreshToken) {
        if (refreshToken) {
            const tokenHash = this.hashToken(refreshToken);
            const redisClient = this.redisService.getClient();
            const sessionKey = `tenant:${tenantId}:session:${userId}:${tokenHash}`;
            await redisClient.del(sessionKey);
        }
    }
    async generateTokensExt(userId, tenantId, role, name) {
        const payload = {
            sub: userId,
            tenant_id: tenantId,
            name,
            role,
        };
        const accessToken = this.jwtService.sign(payload);
        const randomString = (0, crypto_1.randomBytes)(48).toString('hex');
        const refreshToken = `${userId}.${tenantId}.${randomString}`;
        const tokenHash = this.hashToken(refreshToken);
        const redisClient = this.redisService.getClient();
        const sessionKey = `tenant:${tenantId}:session:${userId}:${tokenHash}`;
        await redisClient.set(sessionKey, JSON.stringify({
            createdAt: new Date().toISOString(),
        }), 'EX', 604800);
        return {
            accessToken,
            refreshToken,
            user: {
                id: userId,
                name,
                role,
            },
            tenantId,
        };
    }
    hashToken(token) {
        return (0, crypto_1.createHash)('sha256').update(token).digest('hex');
    }
};
exports.AuthService = AuthService;
exports.AuthService = AuthService = AuthService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        jwt_1.JwtService,
        password_hasher_service_1.PasswordHasherService,
        redis_service_1.RedisService,
        mail_service_1.MailService])
], AuthService);
//# sourceMappingURL=auth.service.js.map