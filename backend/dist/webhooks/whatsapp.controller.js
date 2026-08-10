"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WhatsappController = void 0;
const common_1 = require("@nestjs/common");
const bullmq_1 = require("@nestjs/bullmq");
const bullmq_2 = require("bullmq");
const crypto = __importStar(require("crypto"));
const idempotency_service_1 = require("./idempotency.service");
let WhatsappController = class WhatsappController {
    whatsappQueue;
    idempotencyService;
    constructor(whatsappQueue, idempotencyService) {
        this.whatsappQueue = whatsappQueue;
        this.idempotencyService = idempotencyService;
    }
    verifyWebhook(mode, token, challenge, res) {
        const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN || 'vendora-verify-token';
        if (mode === 'subscribe' && token === verifyToken) {
            return res.status(200).send(challenge);
        }
        return res.status(403).send('Forbidden');
    }
    async handleWebhook(req, signature, res) {
        if (!signature || !req.rawBody) {
            throw new common_1.UnauthorizedException('Missing signature or raw body');
        }
        const secret = process.env.WHATSAPP_APP_SECRET;
        if (!secret) {
            throw new Error('WHATSAPP_APP_SECRET is not configured');
        }
        const expectedSignature = `sha256=${crypto.createHmac('sha256', secret).update(req.rawBody, 'utf8').digest('hex')}`;
        try {
            const isValid = crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature));
            if (!isValid) {
                throw new common_1.UnauthorizedException('Invalid signature');
            }
        }
        catch (e) {
            throw new common_1.UnauthorizedException('Invalid signature');
        }
        res.status(200).send('OK');
        this.processWebhookAsync(req.body).catch((err) => {
            console.error('Error processing webhook async:', err);
        });
    }
    async processWebhookAsync(payload) {
        if (payload.object !== 'whatsapp_business_account' || !payload.entry || !payload.entry[0]) {
            return;
        }
        const entry = payload.entry[0];
        const changes = entry.changes && entry.changes[0];
        const value = changes && changes.value;
        if (!value || !value.messages || !value.messages[0]) {
            return;
        }
        const message = value.messages[0];
        const wamid = message.id;
        const isProcessed = await this.idempotencyService.checkMessageProcessed(wamid);
        if (isProcessed) {
            return;
        }
        await this.whatsappQueue.add('process-message', payload);
    }
};
exports.WhatsappController = WhatsappController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Query)('hub.mode')),
    __param(1, (0, common_1.Query)('hub.verify_token')),
    __param(2, (0, common_1.Query)('hub.challenge')),
    __param(3, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, Object]),
    __metadata("design:returntype", void 0)
], WhatsappController.prototype, "verifyWebhook", null);
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Headers)('x-hub-signature-256')),
    __param(2, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", Promise)
], WhatsappController.prototype, "handleWebhook", null);
exports.WhatsappController = WhatsappController = __decorate([
    (0, common_1.Controller)('api/v1/webhooks/whatsapp'),
    __param(0, (0, bullmq_1.InjectQueue)('whatsapp-ingestion')),
    __metadata("design:paramtypes", [bullmq_2.Queue,
        idempotency_service_1.IdempotencyService])
], WhatsappController);
//# sourceMappingURL=whatsapp.controller.js.map