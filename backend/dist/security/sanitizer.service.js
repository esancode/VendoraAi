"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SanitizerService = void 0;
const common_1 = require("@nestjs/common");
const ioredis_1 = __importDefault(require("ioredis"));
require("dotenv/config");
let SanitizerService = class SanitizerService {
    redisClient;
    cpfRegex = /\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g;
    emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    creditCardRegex = /\b(?:\d{4}[ -]?){3}\d{3,4}\b|\b\d{13,16}\b/g;
    onModuleInit() {
        const redisUrl = process.env.REDIS_URL;
        if (redisUrl) {
            this.redisClient = new ioredis_1.default(redisUrl, { maxRetriesPerRequest: null });
        }
        else {
            this.redisClient = new ioredis_1.default({
                host: process.env.REDIS_HOST || 'localhost',
                port: parseInt(process.env.REDIS_PORT || '6379', 10),
                db: 2,
                maxRetriesPerRequest: null,
            });
        }
        this.redisClient.on('error', (err) => {
            console.error('[SanitizerService] Redis Error:', err.message);
        });
    }
    onModuleDestroy() {
        this.redisClient.disconnect();
    }
    async sanitize(content, tenantId, messageId) {
        if (!content)
            return content;
        const mapping = {};
        let maskedContent = content;
        maskedContent = maskedContent.replace(this.cpfRegex, (match) => {
            const key = `[CPF_MASKED_${this.generateId()}]`;
            mapping[key] = match;
            return key;
        });
        maskedContent = maskedContent.replace(this.emailRegex, (match) => {
            const key = `[EMAIL_MASKED_${this.generateId()}]`;
            mapping[key] = match;
            return key;
        });
        maskedContent = maskedContent.replace(this.creditCardRegex, (match) => {
            const key = `[CARD_MASKED_${this.generateId()}]`;
            mapping[key] = match;
            return key;
        });
        if (Object.keys(mapping).length > 0) {
            const redisKey = `tenant:${tenantId}:sanitized:${messageId}`;
            await this.redisClient.set(redisKey, JSON.stringify(mapping), 'EX', 900);
        }
        return maskedContent;
    }
    generateId() {
        return Math.random().toString(36).substring(2, 8).toUpperCase();
    }
    async unmask(draft, tenantId, messageId) {
        if (!draft)
            return draft;
        const redisKey = `tenant:${tenantId}:sanitized:${messageId}`;
        const mappingStr = await this.redisClient.get(redisKey);
        if (!mappingStr) {
            return draft;
        }
        try {
            const mapping = JSON.parse(mappingStr);
            let unmaskedDraft = draft;
            for (const [key, value] of Object.entries(mapping)) {
                const escapedKey = key.replace(/\[/g, '\\[').replace(/\]/g, '\\]');
                const regex = new RegExp(escapedKey, 'g');
                unmaskedDraft = unmaskedDraft.replace(regex, value);
            }
            return unmaskedDraft;
        }
        catch (e) {
            return draft;
        }
    }
};
exports.SanitizerService = SanitizerService;
exports.SanitizerService = SanitizerService = __decorate([
    (0, common_1.Injectable)()
], SanitizerService);
//# sourceMappingURL=sanitizer.service.js.map