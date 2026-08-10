import { PrismaService } from '../prisma/prisma.service';
import { z } from 'zod';
export declare const CreateWhatsAppChannelSchema: z.ZodObject<{
    name: z.ZodString;
    phoneNumber: z.ZodString;
    agentId: z.ZodNullable<z.ZodOptional<z.ZodString>>;
}, z.core.$strip>;
export declare class WhatsAppChannelsService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    listChannels(tenantId: string): Promise<{
        id: string;
        name: string;
        tenantId: string;
        createdAt: Date;
        updatedAt: Date;
        phoneNumber: string;
        agentId: string | null;
        connectionStatus: import("@prisma/client").$Enums.ConnectionStatus;
        sessionData: string | null;
    }[]>;
    createChannel(tenantId: string, data: z.infer<typeof CreateWhatsAppChannelSchema>): Promise<{
        id: string;
        name: string;
        tenantId: string;
        createdAt: Date;
        updatedAt: Date;
        phoneNumber: string;
        agentId: string | null;
        connectionStatus: import("@prisma/client").$Enums.ConnectionStatus;
        sessionData: string | null;
    }>;
    bindAgent(tenantId: string, channelId: string, agentId: string | null): Promise<{
        id: string;
        name: string;
        tenantId: string;
        createdAt: Date;
        updatedAt: Date;
        phoneNumber: string;
        agentId: string | null;
        connectionStatus: import("@prisma/client").$Enums.ConnectionStatus;
        sessionData: string | null;
    }>;
    deleteChannel(tenantId: string, channelId: string): Promise<{
        id: string;
        name: string;
        tenantId: string;
        createdAt: Date;
        updatedAt: Date;
        phoneNumber: string;
        agentId: string | null;
        connectionStatus: import("@prisma/client").$Enums.ConnectionStatus;
        sessionData: string | null;
    }>;
}
