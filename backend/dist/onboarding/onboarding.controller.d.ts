import { OnboardingService } from './onboarding.service';
import type { FastifyRequest } from 'fastify';
export declare class OnboardingController {
    private readonly onboardingService;
    constructor(onboardingService: OnboardingService);
    completeOnboarding(req: FastifyRequest, data: any): Promise<{
        success: boolean;
        message: string;
    }>;
}
