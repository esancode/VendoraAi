import { CanActivate, ExecutionContext } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
export interface TenantContext {
    tenantId: string;
    userId: string;
    role: string;
}
declare module 'fastify' {
    interface FastifyRequest {
        tenantContext?: TenantContext;
    }
}
export declare class JwtAuthGuard implements CanActivate {
    private readonly jwtService;
    constructor(jwtService: JwtService);
    canActivate(context: ExecutionContext): Promise<boolean>;
    private extractTokenFromHeader;
}
