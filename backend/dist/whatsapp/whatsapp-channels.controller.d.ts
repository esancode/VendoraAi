import { WhatsAppChannelsService } from './whatsapp-channels.service';
import { WhatsappQrCodeService } from './whatsapp-qrcode.service';
import type { FastifyRequest } from 'fastify';
export declare class WhatsAppChannelsController {
    private readonly channelsService;
    private readonly qrCodeService;
    constructor(channelsService: WhatsAppChannelsService, qrCodeService: WhatsappQrCodeService);
    listChannels(req: FastifyRequest): Promise<{
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
    createChannel(req: FastifyRequest, body: any): Promise<{
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
    bindAgent(req: FastifyRequest, id: string, body: any): Promise<{
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
    deleteChannel(req: FastifyRequest, id: string): Promise<{
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
    connectChannel(req: FastifyRequest, id: string): Promise<{
        message: string;
    }>;
    disconnectChannel(req: FastifyRequest, id: string): Promise<{
        message: string;
    }>;
}
