import { Controller, Post, Get, Body, Req, Res, HttpCode, HttpStatus, UnauthorizedException, UseGuards, Redirect } from '@nestjs/common';
import { AuthService } from '../services/auth.service';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { AuthGuard } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';

@Controller('api/v1/auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() body: any, @Req() req: FastifyRequest & { ip: string }, @Res({ passthrough: true }) res: FastifyReply) {
    const { email, password } = body;
    const ip = req.ip || '127.0.0.1';
    
    const { accessToken, refreshToken, user, tenantId } = await this.authService.login(email, password, ip);

    this.setRefreshTokenCookie(res, refreshToken);
    return { accessToken, user, tenantId };
  }

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(@Body() body: any) {
    return await this.authService.register(body);
  }

  @Post('verify-code')
  @HttpCode(HttpStatus.OK)
  async verifyCode(@Body() body: any, @Res({ passthrough: true }) res: FastifyReply) {
    const { email, code } = body;
    const { accessToken, refreshToken, user, tenantId } = await this.authService.verifyCode(email, code);
    this.setRefreshTokenCookie(res, refreshToken);
    return { accessToken, user, tenantId };
  }

  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  async forgotPassword(@Body() body: { email: string }) {
    return await this.authService.forgotPassword(body.email);
  }

  @Post('verify-recovery-code')
  @HttpCode(HttpStatus.OK)
  async verifyRecoveryCode(@Body() body: { email: string; code: string }) {
    return await this.authService.verifyRecoveryCode(body.email, body.code);
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  async resetPassword(@Body() body: { token: string; password_raw: string }) {
    return await this.authService.resetPassword(body.token, body.password_raw);
  }

  @Get('google')
  @Redirect()
  async googleAuth() {
    try {
      const clientId = this.configService.get<string>('GOOGLE_CLIENT_ID') || '';
      const redirectUri = this.configService.get<string>('GOOGLE_CALLBACK_URL') || '';
      const scope = encodeURIComponent('email profile');
      const url = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=${scope}`;
      
      console.log('Redirecting to:', url);
      return { url, statusCode: 302 };
    } catch (error: any) {
      console.error('Error in googleAuth:', error);
      return { url: 'http://localhost:5173/login?error=oauth_init_failed', statusCode: 302 };
    }
  }

  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  @Redirect()
  async googleAuthRedirect(@Req() req: any, @Res({ passthrough: true }) res: FastifyReply) {
    const { accessToken, refreshToken, tenantId } = await this.authService.googleLogin(req.user);
    this.setRefreshTokenCookie(res, refreshToken);
    
    const frontendUrl = this.configService.get<string>('FRONTEND_URL') || 'http://localhost:5173';
    return { url: `${frontendUrl}/auth-success?token=${accessToken}`, statusCode: 302 };
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Req() req: FastifyRequest, @Res({ passthrough: true }) res: FastifyReply) {
    const refreshToken = req.cookies['refresh_token'];
    if (!refreshToken) {
      throw new UnauthorizedException('No refresh token provided');
    }
    
    const { accessToken, refreshToken: newRefreshToken, user, tenantId } = await this.authService.refreshSession(refreshToken);
    this.setRefreshTokenCookie(res, newRefreshToken);

    return { accessToken, user, tenantId };
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async getMe(@Req() req: FastifyRequest) {
    const tenantContext = req.tenantContext;
    if (!tenantContext) {
      throw new UnauthorizedException();
    }
    return await this.authService.getMe(tenantContext.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(@Req() req: FastifyRequest, @Res({ passthrough: true }) res: FastifyReply) {
    const refreshToken = req.cookies['refresh_token'];
    const tenantContext = req.tenantContext;
    if (tenantContext && refreshToken) {
      await this.authService.logout(tenantContext.userId, tenantContext.tenantId, refreshToken);
    }
    res.clearCookie('refresh_token', {
      path: '/api/v1/auth/refresh',
    });
  }

  private setRefreshTokenCookie(res: FastifyReply, refreshToken: string) {
    res.setCookie('refresh_token', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/api/v1/auth/refresh',
      maxAge: 7 * 24 * 60 * 60, // 7 days
    });
  }
}
