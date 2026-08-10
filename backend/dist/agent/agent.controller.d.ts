import type { FastifyRequest } from 'fastify';
import { AgentReplyService } from './agent-reply.service';
import { AgentService } from './agent.service';
export declare class AgentController {
    private readonly agentReplyService;
    private readonly agentService;
    constructor(agentReplyService: AgentReplyService, agentService: AgentService);
    listAgents(req: FastifyRequest): Promise<{
        tone: any;
        maxDiscount: any;
        refundPolicy: any;
        useEmojis: any;
        id: string;
        name: string;
        tenantId: string;
        status: boolean;
        createdAt: Date;
        updatedAt: Date;
        temperature: import("@prisma/client-runtime-utils").Decimal;
        onboardingAnswers: import("@prisma/client/runtime/client").JsonValue;
        basePrompt: string | null;
    }[]>;
    getAgent(req: FastifyRequest, id: string): Promise<{
        tone: any;
        maxDiscount: any;
        refundPolicy: any;
        useEmojis: any;
        id: string;
        name: string;
        tenantId: string;
        status: boolean;
        createdAt: Date;
        updatedAt: Date;
        temperature: import("@prisma/client-runtime-utils").Decimal;
        onboardingAnswers: import("@prisma/client/runtime/client").JsonValue;
        basePrompt: string | null;
    }>;
    createAgent(req: FastifyRequest, body: any): Promise<{
        id: string;
        name: string;
        tenantId: string;
        status: boolean;
        createdAt: Date;
        updatedAt: Date;
        temperature: import("@prisma/client-runtime-utils").Decimal;
        onboardingAnswers: import("@prisma/client/runtime/client").JsonValue;
        basePrompt: string | null;
    }>;
    updateAgent(req: FastifyRequest, id: string, body: any): Promise<{
        id: string;
        name: string;
        tenantId: string;
        status: boolean;
        createdAt: Date;
        updatedAt: Date;
        temperature: import("@prisma/client-runtime-utils").Decimal;
        onboardingAnswers: import("@prisma/client/runtime/client").JsonValue;
        basePrompt: string | null;
    }>;
    deleteAgent(req: FastifyRequest, id: string): Promise<{
        id: string;
        name: string;
        tenantId: string;
        status: boolean;
        createdAt: Date;
        updatedAt: Date;
        temperature: import("@prisma/client-runtime-utils").Decimal;
        onboardingAnswers: import("@prisma/client/runtime/client").JsonValue;
        basePrompt: string | null;
    }>;
    listExamples(req: FastifyRequest, id: string): Promise<{
        id: string;
        tenantId: string;
        createdAt: Date;
        agentId: string;
        userQuery: string;
        expectedResponse: string;
    }[]>;
    addExample(req: FastifyRequest, id: string, body: {
        userQuery: string;
        expectedResponse: string;
    }): Promise<{
        id: string;
        tenantId: string;
        createdAt: Date;
        agentId: string;
        userQuery: string;
        expectedResponse: string;
    }>;
    deleteExample(req: FastifyRequest, id: string, exampleId: string): Promise<{
        id: string;
        tenantId: string;
        createdAt: Date;
        agentId: string;
        userQuery: string;
        expectedResponse: string;
    }>;
    replyToLead(body: any): Promise<{
        success: boolean;
        messageId: string;
    }>;
}
