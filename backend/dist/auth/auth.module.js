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
var AuthModule_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthModule = void 0;
const common_1 = require("@nestjs/common");
const jwt_1 = require("@nestjs/jwt");
const config_1 = require("@nestjs/config");
const password_hasher_service_1 = require("./services/password-hasher.service");
const auth_service_1 = require("./services/auth.service");
const auth_controller_1 = require("./controllers/auth.controller");
const prisma_module_1 = require("../prisma/prisma.module");
const google_strategy_1 = require("./strategies/google.strategy");
let AuthModule = AuthModule_1 = class AuthModule {
    configService;
    logger = new common_1.Logger(AuthModule_1.name);
    constructor(configService) {
        this.configService = configService;
        const clientId = this.configService.get('GOOGLE_CLIENT_ID');
        const clientSecret = this.configService.get('GOOGLE_CLIENT_SECRET');
        if (!clientId ||
            clientId === 'seu_client_id_do_google_aqui.apps.googleusercontent.com' ||
            !clientSecret ||
            clientSecret === 'seu_client_secret_do_google_aqui') {
            this.logger.warn('[WARNING] Google OAuth credentials not set. Single Sign-On will not function until real credentials are provided in the .env file.');
        }
    }
};
exports.AuthModule = AuthModule;
exports.AuthModule = AuthModule = AuthModule_1 = __decorate([
    (0, common_1.Global)(),
    (0, common_1.Module)({
        imports: [
            prisma_module_1.PrismaModule,
            config_1.ConfigModule,
            jwt_1.JwtModule.register({
                secret: process.env.JWT_SECRET || 'vendora-super-secret-key-12345',
                signOptions: { expiresIn: '15m' },
            }),
        ],
        providers: [auth_service_1.AuthService, google_strategy_1.GoogleStrategy, password_hasher_service_1.PasswordHasherService],
        controllers: [auth_controller_1.AuthController],
        exports: [auth_service_1.AuthService, jwt_1.JwtModule],
    }),
    __metadata("design:paramtypes", [config_1.ConfigService])
], AuthModule);
//# sourceMappingURL=auth.module.js.map