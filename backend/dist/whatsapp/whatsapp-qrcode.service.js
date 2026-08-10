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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var WhatsappQrCodeService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.WhatsappQrCodeService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const encryption_service_1 = require("../security/encryption.service");
const notification_gateway_1 = require("../notifications/notification.gateway");
const bullmq_1 = require("@nestjs/bullmq");
const bullmq_2 = require("bullmq");
const client_1 = require("@prisma/client");
const baileys_1 = __importStar(require("@whiskeysockets/baileys"));
const QRCode = __importStar(require("qrcode"));
const pino_1 = __importDefault(require("pino"));
let WhatsappQrCodeService = WhatsappQrCodeService_1 = class WhatsappQrCodeService {
    prisma;
    encryptionService;
    notificationGateway;
    ingestionQueue;
    logger = new common_1.Logger(WhatsappQrCodeService_1.name);
    activeSessions = new Map();
    loggerPino = (0, pino_1.default)({ level: 'silent' });
    constructor(prisma, encryptionService, notificationGateway, ingestionQueue) {
        this.prisma = prisma;
        this.encryptionService = encryptionService;
        this.notificationGateway = notificationGateway;
        this.ingestionQueue = ingestionQueue;
    }
    comparePhoneNumbers(registered, scanned) {
        const cleanReg = registered.replace(/\D/g, '');
        const cleanScan = scanned.split('@')[0].split(':')[0].replace(/\D/g, '');
        if (cleanReg === cleanScan)
            return true;
        if (cleanReg.startsWith('55') && cleanScan.startsWith('55')) {
            const dddReg = cleanReg.substring(2, 4);
            const dddScan = cleanScan.substring(2, 4);
            if (dddReg !== dddScan)
                return false;
            const last8Reg = cleanReg.slice(-8);
            const last8Scan = cleanScan.slice(-8);
            return last8Reg === last8Scan;
        }
        return false;
    }
    async initializeSession(tenantId, channelId) {
        const channel = await this.prisma.whatsAppChannel.findUnique({
            where: { id: channelId },
        });
        if (!channel) {
            throw new common_1.NotFoundException('Canal não encontrado.');
        }
        if (this.activeSessions.has(channelId)) {
            this.logger.warn(`Sessão já ativa para o canal ${channelId}`);
            return;
        }
        await this.prisma.whatsAppChannel.update({
            where: { id: channelId },
            data: { connectionStatus: client_1.ConnectionStatus.CONNECTING },
        });
        const { state, saveCreds } = await this.useDatabaseAuthState(channelId);
        const { version } = await (0, baileys_1.fetchLatestBaileysVersion)();
        const sock = (0, baileys_1.default)({
            version,
            logger: this.loggerPino,
            printQRInTerminal: false,
            auth: state,
            generateHighQualityLinkPreview: true,
            syncFullHistory: false,
        });
        this.activeSessions.set(channelId, sock);
        sock.ev.on('creds.update', saveCreds);
        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update;
            if (qr) {
                try {
                    const qrCodeBase64 = await QRCode.toDataURL(qr);
                    await this.prisma.whatsAppChannel.update({
                        where: { id: channelId },
                        data: { connectionStatus: client_1.ConnectionStatus.QR_READY },
                    });
                    this.notificationGateway.broadcastToTenant(tenantId, 'channel.qr_generated', {
                        channelId,
                        qrCodeBase64,
                    });
                    this.logger.log(`QR Code gerado para o canal ${channelId}.`);
                }
                catch (err) {
                    this.logger.error(`Erro ao gerar QR Code: ${err.message}`);
                }
            }
            if (connection === 'close') {
                const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== baileys_1.DisconnectReason.loggedOut;
                this.logger.warn(`Conexão fechada para ${channelId}. Motivo: ${lastDisconnect?.error}. Reconectar: ${shouldReconnect}`);
                if (shouldReconnect) {
                    this.activeSessions.delete(channelId);
                    setTimeout(() => this.initializeSession(tenantId, channelId), 5000);
                }
                else {
                    await this.disconnectSession(tenantId, channelId);
                }
            }
            else if (connection === 'open') {
                const scannedPhone = sock.user?.id;
                if (scannedPhone && !this.comparePhoneNumbers(channel.phoneNumber, scannedPhone)) {
                    this.logger.error(`Tentativa de fraude/mismatch: Canal ${channel.phoneNumber} escaneado por ${scannedPhone}`);
                    try {
                        await sock.logout?.();
                    }
                    catch (e) {
                        this.logger.warn(`Erro ao deslogar fisicamente o canal ${channelId}: ${e.message}`);
                    }
                    sock.ws?.close?.();
                    this.activeSessions.delete(channelId);
                    await this.prisma.whatsAppChannel.update({
                        where: { id: channelId },
                        data: {
                            connectionStatus: client_1.ConnectionStatus.DISCONNECTED,
                            sessionData: null,
                        },
                    });
                    this.notificationGateway.broadcastToTenant(tenantId, 'channel.connection_error', {
                        channelId,
                        errorType: 'NUMBER_MISMATCH',
                        message: `Conexão abortada: O WhatsApp que escaneou o QR Code não corresponde ao número cadastrado para este canal.`,
                    });
                    return;
                }
                this.logger.log(`Conexão estabelecida com sucesso para o canal ${channelId}`);
                await this.prisma.whatsAppChannel.update({
                    where: { id: channelId },
                    data: { connectionStatus: client_1.ConnectionStatus.CONNECTED },
                });
                this.notificationGateway.broadcastToTenant(tenantId, 'channel.connected', {
                    channelId,
                });
            }
        });
        sock.ev.on('messages.upsert', async (m) => {
            if (m.type !== 'notify')
                return;
            for (const msg of m.messages) {
                if (!msg.message || msg.key.fromMe)
                    continue;
                const fromPhone = msg.key.remoteJid?.split('@')[0];
                const textContent = msg.message.conversation || msg.message.extendedTextMessage?.text || '';
                const contactName = msg.pushName || 'Desconhecido';
                const timestamp = msg.messageTimestamp?.toString() || Math.floor(Date.now() / 1000).toString();
                const wamid = msg.key.id;
                if (!fromPhone || !wamid)
                    continue;
                const currentChannel = await this.prisma.whatsAppChannel.findUnique({ where: { id: channelId } });
                if (!currentChannel)
                    continue;
                const payload = {
                    object: 'whatsapp_business_account',
                    entry: [
                        {
                            id: 'qr_entry_id',
                            changes: [
                                {
                                    value: {
                                        messaging_product: 'whatsapp',
                                        metadata: {
                                            display_phone_number: currentChannel.phoneNumber,
                                            phone_number_id: currentChannel.id,
                                        },
                                        contacts: [
                                            {
                                                profile: { name: contactName },
                                                wa_id: fromPhone,
                                            },
                                        ],
                                        messages: [
                                            {
                                                from: fromPhone,
                                                id: wamid,
                                                timestamp,
                                                type: 'text',
                                                text: {
                                                    body: textContent,
                                                },
                                            },
                                        ],
                                    },
                                    field: 'messages',
                                },
                            ],
                        },
                    ],
                };
                await this.ingestionQueue.add('process-whatsapp-message', payload, {
                    jobId: wamid,
                    removeOnComplete: true,
                    removeOnFail: 10,
                });
                this.logger.log(`Mensagem do Baileys recebida e enfileirada no BullMQ para o canal ${channelId}`);
            }
        });
    }
    async disconnectSession(tenantId, channelId) {
        const sock = this.activeSessions.get(channelId);
        if (sock) {
            try {
                await sock.logout?.();
            }
            catch (e) {
                this.logger.warn(`Erro ao deslogar fisicamente o canal ${channelId}: ${e.message}`);
            }
            sock.ws?.close?.();
            this.activeSessions.delete(channelId);
        }
        await this.prisma.runInTenantContext(tenantId, async (tx) => {
            await tx.whatsAppChannel.update({
                where: { id: channelId },
                data: {
                    connectionStatus: client_1.ConnectionStatus.DISCONNECTED,
                    sessionData: null,
                },
            });
        });
        this.logger.log(`Canal ${channelId} desconectado e chaves apagadas.`);
    }
    async useDatabaseAuthState(channelId) {
        let creds;
        let keys = {};
        const channel = await this.prisma.whatsAppChannel.findUnique({
            where: { id: channelId },
        });
        if (channel?.sessionData) {
            try {
                const decryptedStr = this.encryptionService.decrypt(channel.sessionData);
                const parsed = JSON.parse(decryptedStr, baileys_1.BufferJSON.reviver);
                creds = parsed.creds;
                keys = parsed.keys || {};
            }
            catch (err) {
                this.logger.error(`Erro ao restaurar sessão criptografada para ${channelId}:`, err);
                creds = (0, baileys_1.initAuthCreds)();
                keys = {};
            }
        }
        else {
            creds = (0, baileys_1.initAuthCreds)();
        }
        const saveCreds = async () => {
            const payload = JSON.stringify({ creds, keys }, baileys_1.BufferJSON.replacer);
            const encrypted = this.encryptionService.encrypt(payload);
            await this.prisma.whatsAppChannel.update({
                where: { id: channelId },
                data: { sessionData: encrypted },
            });
        };
        return {
            state: {
                creds,
                keys: {
                    get: (type, ids) => {
                        const data = {};
                        for (const id of ids) {
                            let value = keys[`${type}-${id}`];
                            if (type === 'app-state-sync-key' && value) {
                                value = Object.assign({}, value);
                            }
                            data[id] = value;
                        }
                        return data;
                    },
                    set: (data) => {
                        for (const category in data) {
                            for (const id in data[category]) {
                                const value = data[category][id];
                                const key = `${category}-${id}`;
                                if (value) {
                                    keys[key] = value;
                                }
                                else {
                                    delete keys[key];
                                }
                            }
                        }
                    }
                }
            },
            saveCreds,
        };
    }
};
exports.WhatsappQrCodeService = WhatsappQrCodeService;
exports.WhatsappQrCodeService = WhatsappQrCodeService = WhatsappQrCodeService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(3, (0, bullmq_1.InjectQueue)('whatsapp-ingestion')),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        encryption_service_1.EncryptionService,
        notification_gateway_1.NotificationGateway,
        bullmq_2.Queue])
], WhatsappQrCodeService);
//# sourceMappingURL=whatsapp-qrcode.service.js.map