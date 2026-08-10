import { Controller, Get, Post, Req, Res, Query, Headers, UnauthorizedException } from '@nestjs/common';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import * as crypto from 'crypto';
import { IdempotencyService } from './idempotency.service';

@Controller('api/v1/webhooks/whatsapp')
export class WhatsappController {
  constructor(
    @InjectQueue('whatsapp-ingestion') private readonly whatsappQueue: Queue,
    private readonly idempotencyService: IdempotencyService,
  ) {}

  @Get()
  verifyWebhook(
    @Query('hub.mode') mode: string,
    @Query('hub.verify_token') token: string,
    @Query('hub.challenge') challenge: string,
    @Res() res: FastifyReply,
  ) {
    const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN || 'vendora-verify-token';

    if (mode === 'subscribe' && token === verifyToken) {
      // The challenge must be returned as a plain string, not JSON
      return res.status(200).send(challenge);
    }
    
    return res.status(403).send('Forbidden');
  }

  @Post()
  async handleWebhook(
    @Req() req: FastifyRequest & { rawBody?: string },
    @Headers('x-hub-signature-256') signature: string,
    @Res() res: FastifyReply,
  ) {
    // 1. HMAC Validation
    if (!signature || !req.rawBody) {
      throw new UnauthorizedException('Missing signature or raw body');
    }

    const secret = process.env.WHATSAPP_APP_SECRET;
    if (!secret) {
      throw new Error('WHATSAPP_APP_SECRET is not configured');
    }

    const expectedSignature = `sha256=${crypto.createHmac('sha256', secret).update(req.rawBody, 'utf8').digest('hex')}`;
    
    try {
      const isValid = crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expectedSignature)
      );

      if (!isValid) {
        throw new UnauthorizedException('Invalid signature');
      }
    } catch (e) {
      // Handle length mismatch in Buffer.from for timingSafeEqual
      throw new UnauthorizedException('Invalid signature');
    }

    // Return 200 OK immediately and process async
    res.status(200).send('OK');

    // Proceed asynchronously to avoid blocking the fast HTTP response
    this.processWebhookAsync(req.body).catch((err) => {
      console.error('Error processing webhook async:', err);
    });
  }

  private async processWebhookAsync(payload: any) {
    // Basic structure check for WhatsApp messages
    if (payload.object !== 'whatsapp_business_account' || !payload.entry || !payload.entry[0]) {
      return;
    }

    const entry = payload.entry[0];
    const changes = entry.changes && entry.changes[0];
    const value = changes && changes.value;

    if (!value || !value.messages || !value.messages[0]) {
      // This might be a status update, not a message
      return;
    }

    const message = value.messages[0];
    const wamid = message.id;

    // 2. Idempotency Check
    const isProcessed = await this.idempotencyService.checkMessageProcessed(wamid);
    if (isProcessed) {
      // Skip redundant processing
      return;
    }

    // 3. Enqueue Message
    await this.whatsappQueue.add('process-message', payload);
  }
}
