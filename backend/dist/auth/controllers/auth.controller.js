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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthController = void 0;
const common_1 = require("@nestjs/common");
const auth_service_1 = require("../services/auth.service");
const jwt_auth_guard_1 = require("../guards/jwt-auth.guard");
const passport_1 = require("@nestjs/passport");
const config_1 = require("@nestjs/config");
let AuthController = class AuthController {
    authService;
    configService;
    constructor(authService, configService) {
        this.authService = authService;
        this.configService = configService;
    }
    async login(body, req, res) {
        const { email, password } = body;
        const ip = req.ip || '127.0.0.1';
        const { accessToken, refreshToken, user, tenantId } = await this.authService.login(email, password, ip);
        this.setRefreshTokenCookie(res, refreshToken);
        return { accessToken, user, tenantId };
    }
    async register(body) {
        return await this.authService.register(body);
    }
    async verifyCode(body, res) {
        const { email, code } = body;
        const { accessToken, refreshToken, user, tenantId } = await this.authService.verifyCode(email, code);
        this.setRefreshTokenCookie(res, refreshToken);
        return { accessToken, user, tenantId };
    }
    async forgotPassword(body) {
        return await this.authService.forgotPassword(body.email);
    }
    async verifyRecoveryCode(body) {
        return await this.authService.verifyRecoveryCode(body.email, body.code);
    }
    async resetPassword(body) {
        return await this.authService.resetPassword(body.token, body.password_raw);
    }
    async googleAuth() {
        try {
            const clientId = this.configService.get('GOOGLE_CLIENT_ID') || '';
            const redirectUri = this.configService.get('GOOGLE_CALLBACK_URL') || '';
            const scope = encodeURIComponent('email profile');
            const url = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=${scope}`;
            console.log('Redirecting to:', url);
            return { url, statusCode: 302 };
        }
        catch (error) {
            console.error('Error in googleAuth:', error);
            return { url: 'http://localhost:5173/login?error=oauth_init_failed', statusCode: 302 };
        }
    }
    async googleAuthRedirect(req, res) {
        const { accessToken, refreshToken, tenantId } = await this.authService.googleLogin(req.user);
        this.setRefreshTokenCookie(res, refreshToken);
        const frontendUrl = this.configService.get('FRONTEND_URL') || 'http://localhost:5173';
        return { url: `${frontendUrl}/auth-success?token=${accessToken}`, statusCode: 302 };
    }
    async refresh(req, res) {
        const refreshToken = req.cookies['refresh_token'];
        if (!refreshToken) {
            throw new common_1.UnauthorizedException('No refresh token provided');
        }
        const { accessToken, refreshToken: newRefreshToken, user, tenantId } = await this.authService.refreshSession(refreshToken);
        this.setRefreshTokenCookie(res, newRefreshToken);
        return { accessToken, user, tenantId };
    }
    async getMe(req) {
        const tenantContext = req.tenantContext;
        if (!tenantContext) {
            throw new common_1.UnauthorizedException();
        }
        return await this.authService.getMe(tenantContext.userId);
    }
    async logout(req, res) {
        const refreshToken = req.cookies['refresh_token'];
        const tenantContext = req.tenantContext;
        if (tenantContext && refreshToken) {
            await this.authService.logout(tenantContext.userId, tenantContext.tenantId, refreshToken);
        }
        res.clearCookie('refresh_token', {
            path: '/',
        });
    }
    setRefreshTokenCookie(res, refreshToken) {
        res.setCookie('refresh_token', refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'none',
            path: '/',
            maxAge: 7 * 24 * 60 * 60,
        });
    }
};
exports.AuthController = AuthController;
__decorate([
    (0, common_1.Post)('login'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __param(2, (0, common_1.Res)({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "login", null);
__decorate([
    (0, common_1.Post)('register'),
    (0, common_1.HttpCode)(common_1.HttpStatus.CREATED),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "register", null);
__decorate([
    (0, common_1.Post)('verify-code'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Res)({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "verifyCode", null);
__decorate([
    (0, common_1.Post)('forgot-password'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "forgotPassword", null);
__decorate([
    (0, common_1.Post)('verify-recovery-code'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "verifyRecoveryCode", null);
__decorate([
    (0, common_1.Post)('reset-password'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "resetPassword", null);
__decorate([
    (0, common_1.Get)('google'),
    (0, common_1.Redirect)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "googleAuth", null);
__decorate([
    (0, common_1.Get)('google/callback'),
    (0, common_1.UseGuards)((0, passport_1.AuthGuard)('google')),
    (0, common_1.Redirect)(),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Res)({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "googleAuthRedirect", null);
__decorate([
    (0, common_1.Post)('refresh'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Res)({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "refresh", null);
__decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Get)('me'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "getMe", null);
__decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Post)('logout'),
    (0, common_1.HttpCode)(common_1.HttpStatus.NO_CONTENT),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Res)({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "logout", null);
exports.AuthController = AuthController = __decorate([
    (0, common_1.Controller)('api/v1/auth'),
    __metadata("design:paramtypes", [auth_service_1.AuthService,
        config_1.ConfigService])
], AuthController);
//# sourceMappingURL=auth.controller.js.map