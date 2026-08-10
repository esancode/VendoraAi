import { Controller, Post, Body, UseGuards, Req } from '@nestjs/common';
import { OnboardingService } from './onboarding.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { FastifyRequest } from 'fastify';

@UseGuards(JwtAuthGuard)
@Controller('api/v1/onboarding')
export class OnboardingController {
  constructor(private readonly onboardingService: OnboardingService) {}

  @Post('complete')
  async completeOnboarding(@Req() req: FastifyRequest, @Body() data: any) {
    const tenantContext = req.tenantContext;
    if (!tenantContext) {
      throw new Error('Tenant context missing');
    }
    return await this.onboardingService.processOnboardingData(tenantContext.tenantId, tenantContext.userId, data);
  }
}
