import { createParamDecorator, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { FastifyRequest } from 'fastify';
import { TenantContext } from '../../auth/guards/jwt-auth.guard';

export const CurrentTenant = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): TenantContext => {
    const request = ctx.switchToHttp().getRequest<FastifyRequest>();
    
    if (!request.tenantContext) {
      throw new UnauthorizedException('Tenant context not found. Is JwtAuthGuard applied?');
    }

    return request.tenantContext;
  },
);
