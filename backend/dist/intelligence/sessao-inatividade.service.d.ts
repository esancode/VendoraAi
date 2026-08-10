import { PrismaService } from '../prisma/prisma.service';
import { AiOrchestratorService } from './ai-orchestrator.service';
export declare class SessaoInatividadeService {
    private readonly prisma;
    private readonly aiOrchestrator;
    private readonly logger;
    constructor(prisma: PrismaService, aiOrchestrator: AiOrchestratorService);
    checkInactiveConversations(): Promise<void>;
}
