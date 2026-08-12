import { Injectable, UnauthorizedException, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../prisma/prisma.service';
import { PasswordHasherService } from './password-hasher.service';
import { RedisService } from '../../common/services/redis.service';
import { MailService } from '../../common/services/mail.service';
import { randomBytes, createHash } from 'crypto';
import { UserRole } from '@prisma/client';

export interface AuthResponse {
  accessToken: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly passwordHasher: PasswordHasherService,
    private readonly redisService: RedisService,
    private readonly mailService: MailService,
  ) {}

  async login(email: string, password_raw: string, ip: string = '127.0.0.1'): Promise<{ accessToken: string; refreshToken: string; user: any; tenantId: string }> {
    email = email.toLowerCase().trim();
    const redisClient = this.redisService.getClient();
    
    // Rate Limiting (5 tentativas por 15 min)
    const rateLimitKey = `ratelimit:login:${email}:${ip}`;
    const attempts = await redisClient.incr(rateLimitKey);
    if (attempts === 1) {
      await redisClient.expire(rateLimitKey, 900);
    }
    if (attempts > 5) {
      throw new HttpException('Too Many Requests', HttpStatus.TOO_MANY_REQUESTS);
    }

    const user = await this.prisma.user.findUnique({
      where: { email },
      include: { tenant: true },
    });

    if (!user) {
      throw new UnauthorizedException('Credenciais inválidas');
    }

    if (user.status === 'LOCKED') {
      throw new UnauthorizedException('Conta bloqueada por segurança. Redefina sua senha.');
    }
    
    if (user.status === 'PENDING_VERIFICATION') {
      throw new UnauthorizedException('Conta pendente de verificação.');
    }

    const isValid = await this.passwordHasher.compare(user.passwordHash, password_raw);
    if (!isValid) {
      // Bloqueio após 10 tentativas
      const lockKey = `lock:account:${email}`;
      const failCount = await redisClient.incr(lockKey);
      if (failCount === 1) {
        await redisClient.expire(lockKey, 1800); // 30 mins window
      }
      if (failCount >= 10) {
        await this.prisma.user.update({ where: { email }, data: { status: 'LOCKED' } });
        await this.mailService.sendSecurityAlertLocked(email);
        await redisClient.del(lockKey);
      }
      throw new UnauthorizedException('Credenciais inválidas');
    }

    // Sucesso, limpa os contadores
    await redisClient.del(rateLimitKey);
    await redisClient.del(`lock:account:${email}`);

    return this.generateTokensExt(user.id, user.tenantId, user.role, user.name);
  }

  async register(data: any): Promise<{ message: string }> {
    let { companyName, adminName, adminEmail, password } = data;
    adminEmail = adminEmail.toLowerCase().trim();

    const existingUser = await this.prisma.user.findUnique({
      where: { email: adminEmail },
    });

    if (existingUser) {
      throw new UnauthorizedException('E-mail já está em uso.');
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
    await redisClient.set(`verification:code:${adminEmail}`, code, 'EX', 600); // 10 min
    await this.mailService.sendVerificationCode(adminEmail, code);

    return { message: 'Código de verificação enviado para o e-mail.' };
  }

  async googleLogin(profile: any): Promise<{ accessToken: string; refreshToken: string; user: any; tenantId: string }> {
    const { email, fullName, avatarUrl } = profile;
    const redisClient = this.redisService.getClient();

    let user: any = await this.prisma.user.findUnique({
      where: { email },
      include: { tenant: true },
    });

    if (!user) {
      // User doesn't exist, create Tenant and User
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

        // Set RLS context for the transaction so the user insertion is permitted
        await prisma.$executeRawUnsafe(`SET LOCAL ROLE app_user;`);
        await prisma.$executeRawUnsafe(`SET LOCAL app.current_tenant_id = '${tenant.id}';`);

        return await prisma.user.create({
          data: {
            email,
            name: fullName,
            passwordHash: 'oauth_managed', // password is not used for oauth
            avatarUrl,
            role: UserRole.ADMIN,
            tenantId: tenant.id,
            status: 'ACTIVE',
          },
          include: { tenant: true },
        });
      });
    } else {
      // Update avatar if missing or changed
      if (avatarUrl && user.avatarUrl !== avatarUrl) {
        user = await this.prisma.user.update({
          where: { id: user.id },
          data: { avatarUrl },
          include: { tenant: true }
        });
      }

      if (user.status === 'LOCKED') {
        throw new UnauthorizedException('Conta bloqueada por segurança.');
      }
      if (user.status === 'PENDING_VERIFICATION') {
        // If they verify via Google, we can mark them active
        user = await this.prisma.user.update({
          where: { id: user.id },
          data: { status: 'ACTIVE' },
          include: { tenant: true }
        });
      }
    }

    return this.generateTokensExt(user.id, user.tenantId, user.role, user.name);
  }

  async verifyCode(email: string, code: string) {
    email = email.toLowerCase().trim();
    const redisClient = this.redisService.getClient();
    const savedCode = await redisClient.get(`verification:code:${email}`);
    
    if (!savedCode || savedCode !== code) {
      throw new UnauthorizedException('Código inválido ou expirado');
    }
    
    const user = await this.prisma.user.update({
      where: { email },
      data: { status: 'ACTIVE' },
    });
    
    await redisClient.del(`verification:code:${email}`);
    
    return this.generateTokensExt(user.id, user.tenantId, user.role, user.name);
  }

  async forgotPassword(email: string) {
    email = email.toLowerCase().trim();
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) return { message: 'Se o e-mail existir, um código de recuperação foi enviado.' };
    
    // Generate 6-digit numeric code
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const redisClient = this.redisService.getClient();
    await redisClient.set(`recovery:${email}`, code, 'EX', 600);
    
    await this.mailService.sendRecoveryCode(email, code);
    return { message: 'Se o e-mail existir, um código de recuperação foi enviado.' };
  }

  async verifyRecoveryCode(email: string, code: string) {
    email = email.toLowerCase().trim();
    const redisClient = this.redisService.getClient();
    const savedCode = await redisClient.get(`recovery:${email}`);
    
    if (!savedCode || savedCode !== code) {
      throw new UnauthorizedException('Código inválido ou expirado');
    }
    
    // Code valid, generate temp reset token (5 mins)
    const resetToken = randomBytes(32).toString('hex');
    await redisClient.set(`reset:token:${resetToken}`, email, 'EX', 300);
    await redisClient.del(`recovery:${email}`);
    
    return { resetToken, message: 'Código verificado com sucesso.' };
  }

  async resetPassword(token: string, newPasswordRaw: string) {
    const redisClient = this.redisService.getClient();
    const email = await redisClient.get(`reset:token:${token}`);
    
    if (!email) {
      throw new UnauthorizedException('Sessão de recuperação expirada. Tente novamente.');
    }
    
    const passwordHash = await this.passwordHasher.hash(newPasswordRaw);
    await this.prisma.user.update({
      where: { email },
      data: { passwordHash, status: 'ACTIVE' },
    });
    
    await redisClient.del(`reset:token:${token}`);
    return { message: 'Senha atualizada com sucesso' };
  }

  async refreshSession(refreshToken: string) {
    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token ausente');
    }

    const tokenHash = this.hashToken(refreshToken);
    const redisClient = this.redisService.getClient();
    const parts = refreshToken.split('.');
    
    if (parts.length !== 3) {
      throw new UnauthorizedException('Formato de token inválido');
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
      throw new UnauthorizedException('Sessão revogada ou expirada');
    }

    await redisClient.del(sessionKey);

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || user.tenantId !== tenantId || user.status !== 'ACTIVE') {
      throw new UnauthorizedException('Usuário inválido ou bloqueado');
    }

    return this.generateTokensExt(user.id, user.tenantId, user.role, user.name);
  }

  async getMe(userId: string) {
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
    
    if (!user) throw new UnauthorizedException('User not found');
    return user;
  }

  async logout(userId: string, tenantId: string, refreshToken: string) {
    if (refreshToken) {
      const tokenHash = this.hashToken(refreshToken);
      const redisClient = this.redisService.getClient();
      const sessionKey = `tenant:${tenantId}:session:${userId}:${tokenHash}`;
      await redisClient.del(sessionKey);
    }
  }

  private async generateTokensExt(userId: string, tenantId: string, role: string, name: string) {
    const payload = {
      sub: userId,
      tenant_id: tenantId,
      name,
      role,
    };

    const accessToken = this.jwtService.sign(payload);
    const randomString = randomBytes(48).toString('hex');
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

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
