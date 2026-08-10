import type { FastifyRequest, FastifyReply } from 'fastify';
import { Queue } from 'bullmq';
import { IdempotencyService } from './idempotency.service';
export declare class WhatsappController {
    private readonly whatsappQueue;
    private readonly idempotencyService;
    constructor(whatsappQueue: Queue, idempotencyService: IdempotencyService);
    verifyWebhook(mode: string, token: string, challenge: string, res: FastifyReply): FastifyReply<import("fastify").RouteGenericInterface, import("fastify").RawServerDefault, import("http").IncomingMessage, import("http").ServerResponse<import("http").IncomingMessage>, unknown, import("fastify").FastifySchema, import("fastify").FastifyTypeProviderDefault, unknown>;
    handleWebhook(req: FastifyRequest & {
        rawBody?: string;
    }, signature: string, res: FastifyReply): Promise<void>;
    private processWebhookAsync;
}
