import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback } from 'passport-google-oauth20';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  private readonly logger = new Logger(GoogleStrategy.name);

  constructor(private configService: ConfigService) {
    const clientID = configService.get<string>('GOOGLE_CLIENT_ID');
    const clientSecret = configService.get<string>('GOOGLE_CLIENT_SECRET');
    const callbackURL = configService.get<string>('GOOGLE_CALLBACK_URL');

    // If these are placeholders, Passport might fail to initialize, but we handle the graceful
    // degrade at the module level. We pass them anyway.
    super({
      clientID: clientID || 'missing_client_id',
      clientSecret: clientSecret || 'missing_client_secret',
      callbackURL: callbackURL || 'http://localhost:3000/api/v1/auth/google/callback',
      scope: ['email', 'profile'],
    });
  }

  async validate(accessToken: string, refreshToken: string, profile: any, done: VerifyCallback): Promise<any> {
    const { name, emails, photos } = profile;
    
    if (!emails || emails.length === 0) {
      return done(new Error('Email not found in Google profile'), false);
    }

    const user = {
      email: emails[0].value,
      firstName: name?.givenName,
      lastName: name?.familyName,
      fullName: name?.givenName ? `${name.givenName} ${name.familyName || ''}`.trim() : 'Google User',
      avatarUrl: photos && photos.length > 0 ? photos[0].value : null,
      accessToken,
    };
    
    // We pass this data to the request.user object
    // Then auth.service will handle the actual DB upsert
    done(null, user);
  }
}
