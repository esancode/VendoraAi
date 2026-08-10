import { Module, Logger, Global } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PasswordHasherService } from './services/password-hasher.service';
import { AuthService } from './services/auth.service';
import { AuthController } from './controllers/auth.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { GoogleStrategy } from './strategies/google.strategy';

@Global()
@Module({
  imports: [
    PrismaModule,
    ConfigModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'vendora-super-secret-key-12345',
      signOptions: { expiresIn: '15m' }, // Access Token Stateless de 15 minutos
    }),
  ],
  providers: [AuthService, GoogleStrategy, PasswordHasherService],
  controllers: [AuthController],
  exports: [AuthService, JwtModule],
})
export class AuthModule {
  private readonly logger = new Logger(AuthModule.name);

  constructor(private configService: ConfigService) {
    const clientId = this.configService.get<string>('GOOGLE_CLIENT_ID');
    const clientSecret = this.configService.get<string>('GOOGLE_CLIENT_SECRET');

    if (
      !clientId || 
      clientId === 'seu_client_id_do_google_aqui.apps.googleusercontent.com' ||
      !clientSecret ||
      clientSecret === 'seu_client_secret_do_google_aqui'
    ) {
      this.logger.warn(
        '[WARNING] Google OAuth credentials not set. Single Sign-On will not function until real credentials are provided in the .env file.'
      );
    }
  }
}
