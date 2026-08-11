import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import Redis from 'ioredis';
import 'dotenv/config';

@Injectable()
export class SanitizerService implements OnModuleInit, OnModuleDestroy {
  private redisClient: Redis;

  // Regex patterns
  private readonly cpfRegex = /\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g;
  private readonly emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  private readonly creditCardRegex = /\b(?:\d{4}[ -]?){3}\d{3,4}\b|\b\d{13,16}\b/g;

  onModuleInit() {
    const redisUrl = process.env.REDIS_URL;
    if (redisUrl) {
      this.redisClient = new Redis(redisUrl, { db: 2 });
    } else {
      this.redisClient = new Redis({
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379', 10),
        db: 2, // Using DB 2 for temporary mapping
      });
    }
  }

  onModuleDestroy() {
    this.redisClient.disconnect();
  }

  /**
   * Sanitizes sensitive data (PII) from a string.
   * Replaces findings with [MASKED_TYPE] and stores the original values in Redis
   * for future restitution with a 15-minute TTL.
   */
  async sanitize(
    content: string,
    tenantId: string,
    messageId: string,
  ): Promise<string> {
    if (!content) return content;

    const mapping: Record<string, string> = {};
    let maskedContent = content;

    // Mask CPF
    maskedContent = maskedContent.replace(this.cpfRegex, (match) => {
      const key = `[CPF_MASKED_${this.generateId()}]`;
      mapping[key] = match;
      return key;
    });

    // Mask Email
    maskedContent = maskedContent.replace(this.emailRegex, (match) => {
      const key = `[EMAIL_MASKED_${this.generateId()}]`;
      mapping[key] = match;
      return key;
    });

    // Mask Credit Card
    maskedContent = maskedContent.replace(this.creditCardRegex, (match) => {
      const key = `[CARD_MASKED_${this.generateId()}]`;
      mapping[key] = match;
      return key;
    });

    // Save to Redis if anything was masked
    if (Object.keys(mapping).length > 0) {
      const redisKey = `tenant:${tenantId}:sanitized:${messageId}`;
      await this.redisClient.set(
        redisKey,
        JSON.stringify(mapping),
        'EX',
        900, // 15 minutes TTL
      );
    }

    return maskedContent;
  }

  private generateId(): string {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
  }

  /**
   * Reconstitutes PII (Local Unmask) by replacing masked tags with original values
   * stored in Redis.
   */
  async unmask(draft: string, tenantId: string, messageId: string): Promise<string> {
    if (!draft) return draft;

    const redisKey = `tenant:${tenantId}:sanitized:${messageId}`;
    const mappingStr = await this.redisClient.get(redisKey);

    if (!mappingStr) {
      // Redis key expired or no masked data
      return draft;
    }

    try {
      const mapping = JSON.parse(mappingStr);
      let unmaskedDraft = draft;

      for (const [key, value] of Object.entries(mapping)) {
        // Use a global replacement since the model might repeat the tag
        // The tag has special characters like '[' and ']' so we need to escape them
        const escapedKey = key.replace(/\[/g, '\\[').replace(/\]/g, '\\]');
        const regex = new RegExp(escapedKey, 'g');
        unmaskedDraft = unmaskedDraft.replace(regex, value as string);
      }

      return unmaskedDraft;
    } catch (e) {
      // JSON parse error, fallback to returning original draft
      return draft;
    }
  }
}
