import { ConfigService } from '@nestjs/config';
export declare class AuthModule {
    private configService;
    private readonly logger;
    constructor(configService: ConfigService);
}
