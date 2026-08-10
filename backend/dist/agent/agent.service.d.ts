import { PrismaService } from '../prisma/prisma.service';
export declare class AgentService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    listAgents(tenantId: string): Promise<{
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
    getAgent(tenantId: string, agentId: string): Promise<{
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
    createAgent(tenantId: string, data: any): Promise<{
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
    updateAgent(tenantId: string, agentId: string, data: any): Promise<{
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
    deleteAgent(tenantId: string, agentId: string): Promise<{
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
    listExamples(tenantId: string, agentId: string): Promise<{
        id: string;
        tenantId: string;
        createdAt: Date;
        agentId: string;
        userQuery: string;
        expectedResponse: string;
    }[]>;
    addExample(tenantId: string, agentId: string, data: {
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
    deleteExample(tenantId: string, exampleId: string): Promise<{
        id: string;
        tenantId: string;
        createdAt: Date;
        agentId: string;
        userQuery: string;
        expectedResponse: string;
    }>;
}
