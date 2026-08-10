import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EncryptionService } from '../security/encryption.service';
import { NotificationGateway } from '../notifications/notification.gateway';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { ConnectionStatus } from '@prisma/client';
import { Boom } from '@hapi/boom';
import makeWASocket, {
  DisconnectReason,
  fetchLatestBaileysVersion,
  initAuthCreds,
  BufferJSON,
  AuthenticationState,
  SignalDataTypeMap
} from '@whiskeysockets/baileys';
import * as QRCode from 'qrcode';
import pino from 'pino';

@Injectable()
export class WhatsappQrCodeService {
  private readonly logger = new Logger(WhatsappQrCodeService.name);
  
  // Estrutura de dados em memória para controlar instâncias ativas do Baileys
  private activeSessions = new Map<string, any>();
  private readonly loggerPino = pino({ level: 'silent' });

  constructor(
    private readonly prisma: PrismaService,
    private readonly encryptionService: EncryptionService,
    private readonly notificationGateway: NotificationGateway,
    @InjectQueue('whatsapp-ingestion') private readonly ingestionQueue: Queue,
  ) {}

  /**
   * Normaliza e compara dois números de telefone.
   * Regra Especial (BR - +55): Compara ignorando a presença do 9º dígito.
   */
  public comparePhoneNumbers(registered: string, scanned: string): boolean {
    // 1. Remover tudo que não for dígito
    const cleanReg = registered.replace(/\D/g, '');
    const cleanScan = scanned.split('@')[0].split(':')[0].replace(/\D/g, '');

    // Se forem exatamente iguais, sucesso imediato
    if (cleanReg === cleanScan) return true;

    // 2. Tratar DDI 55 (Brasil) com problema do 9º dígito
    if (cleanReg.startsWith('55') && cleanScan.startsWith('55')) {
      // Pega apenas o DDD (2 dígitos) e o corpo do telefone
      // Ex: 55 11 999998888 -> DDD 11, resto 999998888
      const dddReg = cleanReg.substring(2, 4);
      const dddScan = cleanScan.substring(2, 4);
      
      if (dddReg !== dddScan) return false;

      // Pega os últimos 8 dígitos numéricos, ignorando se existe o 9 na frente ou não
      const last8Reg = cleanReg.slice(-8);
      const last8Scan = cleanScan.slice(-8);

      return last8Reg === last8Scan;
    }

    return false;
  }

  /**
   * Inicializa a sessão real do Baileys para o canal.
   */
  async initializeSession(tenantId: string, channelId: string) {
    const channel = await this.prisma.whatsAppChannel.findUnique({
      where: { id: channelId },
    });

    if (!channel) {
      throw new NotFoundException('Canal não encontrado.');
    }

    if (this.activeSessions.has(channelId)) {
      this.logger.warn(`Sessão já ativa para o canal ${channelId}`);
      // Se já estiver ativa, tenta apenas emitir o status novamente
      return;
    }

    // Marca como conectando
    await this.prisma.whatsAppChannel.update({
      where: { id: channelId },
      data: { connectionStatus: ConnectionStatus.CONNECTING },
    });

    const { state, saveCreds } = await this.useDatabaseAuthState(channelId);
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
      version,
      logger: this.loggerPino as any,
      printQRInTerminal: false,
      auth: state,
      generateHighQualityLinkPreview: true,
      syncFullHistory: false,
    });

    // Registra a sessão na memória
    this.activeSessions.set(channelId, sock);

    // Evento de Update de Credenciais (Persistência Stateless Criptografada)
    sock.ev.on('creds.update', saveCreds);

    // Evento de Conexão
    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        // Envia QR Code em Base64 via WebSocket
        try {
          const qrCodeBase64 = await QRCode.toDataURL(qr);
          
          await this.prisma.whatsAppChannel.update({
            where: { id: channelId },
            data: { connectionStatus: ConnectionStatus.QR_READY },
          });

          this.notificationGateway.broadcastToTenant(tenantId, 'channel.qr_generated', {
            channelId,
            qrCodeBase64,
          });
          
          this.logger.log(`QR Code gerado para o canal ${channelId}.`);
        } catch (err) {
          this.logger.error(`Erro ao gerar QR Code: ${err.message}`);
        }
      }

      if (connection === 'close') {
        const shouldReconnect = (lastDisconnect?.error as Boom)?.output?.statusCode !== DisconnectReason.loggedOut;
        this.logger.warn(`Conexão fechada para ${channelId}. Motivo: ${lastDisconnect?.error}. Reconectar: ${shouldReconnect}`);
        
        if (shouldReconnect) {
          // Reconectar automaticamente em caso de falha de rede
          this.activeSessions.delete(channelId);
          setTimeout(() => this.initializeSession(tenantId, channelId), 5000);
        } else {
          // Desconectado explicitamente (Logged Out)
          await this.disconnectSession(tenantId, channelId);
        }
      } else if (connection === 'open') {
        const scannedPhone = sock.user?.id;
        
        // Validação de Segurança: O telefone escaneado é o cadastrado?
        if (scannedPhone && !this.comparePhoneNumbers(channel.phoneNumber, scannedPhone)) {
          this.logger.error(`Tentativa de fraude/mismatch: Canal ${channel.phoneNumber} escaneado por ${scannedPhone}`);
          
          // Expurgar sessão e abortar
          try {
            await sock.logout?.();
          } catch (e) {
            this.logger.warn(`Erro ao deslogar fisicamente o canal ${channelId}: ${e.message}`);
          }
          sock.ws?.close?.();
          this.activeSessions.delete(channelId);
          
          await this.prisma.whatsAppChannel.update({
            where: { id: channelId },
            data: {
              connectionStatus: ConnectionStatus.DISCONNECTED,
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
          data: { connectionStatus: ConnectionStatus.CONNECTED },
        });

        this.notificationGateway.broadcastToTenant(tenantId, 'channel.connected', {
          channelId,
        });
      }
    });

    // Recebimento de Mensagens
    sock.ev.on('messages.upsert', async (m) => {
      if (m.type !== 'notify') return;

      for (const msg of m.messages) {
        if (!msg.message || msg.key.fromMe) continue; // Ignora mensagens enviadas por nós mesmos
        
        const fromPhone = msg.key.remoteJid?.split('@')[0];
        const textContent = msg.message.conversation || msg.message.extendedTextMessage?.text || '';
        const contactName = msg.pushName || 'Desconhecido';
        const timestamp = msg.messageTimestamp?.toString() || Math.floor(Date.now() / 1000).toString();
        const wamid = msg.key.id;

        if (!fromPhone || !wamid) continue;

        // Recupera o ID do número da API (ou fallback para o ID do canal se não existir)
        const currentChannel = await this.prisma.whatsAppChannel.findUnique({ where: { id: channelId } });
        if (!currentChannel) continue;

        // Formatação IDÊNTICA ao payload recebido no Webhook da Meta API
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

        // Adiciona na fila com o mesmo formato do controller
        await this.ingestionQueue.add('process-whatsapp-message', payload, {
          jobId: wamid,
          removeOnComplete: true,
          removeOnFail: 10,
        });
        
        this.logger.log(`Mensagem do Baileys recebida e enfileirada no BullMQ para o canal ${channelId}`);
      }
    });
  }

  /**
   * Encerra a conexão ativa.
   */
  async disconnectSession(tenantId: string, channelId: string) {
    const sock = this.activeSessions.get(channelId);
    if (sock) {
      try {
        await sock.logout?.(); // Desloga fisicamente na Meta
      } catch (e) {
        this.logger.warn(`Erro ao deslogar fisicamente o canal ${channelId}: ${e.message}`);
      }
      sock.ws?.close?.();
      this.activeSessions.delete(channelId);
    }

    // Remove credenciais e desconecta
    await this.prisma.runInTenantContext(tenantId, async (tx) => {
      await tx.whatsAppChannel.update({
        where: { id: channelId },
        data: {
          connectionStatus: ConnectionStatus.DISCONNECTED,
          sessionData: null, // Wipe persistência
        },
      });
    });

    this.logger.log(`Canal ${channelId} desconectado e chaves apagadas.`);
  }

  /**
   * Adaptador Stateless de Autenticação usando PostgreSQL e Criptografia
   */
  private async useDatabaseAuthState(channelId: string): Promise<{ state: AuthenticationState, saveCreds: () => Promise<void> }> {
    let creds: any;
    let keys: any = {};

    // 1. Carrega do banco
    const channel = await this.prisma.whatsAppChannel.findUnique({
      where: { id: channelId },
    });

    if (channel?.sessionData) {
      try {
        const decryptedStr = this.encryptionService.decrypt(channel.sessionData);
        const parsed = JSON.parse(decryptedStr, BufferJSON.reviver);
        creds = parsed.creds;
        keys = parsed.keys || {};
      } catch (err) {
        this.logger.error(`Erro ao restaurar sessão criptografada para ${channelId}:`, err);
        creds = initAuthCreds();
        keys = {};
      }
    } else {
      creds = initAuthCreds();
    }

    const saveCreds = async () => {
      const payload = JSON.stringify({ creds, keys }, BufferJSON.replacer);
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
            const data: any = {};
            for (const id of ids) {
              let value = keys[`${type}-${id}`];
              if (type === 'app-state-sync-key' && value) {
                value = Object.assign({}, value); // Avoid mutation issues
              }
              data[id] = value;
            }
            return data;
          },
          set: (data: any) => {
            for (const category in data) {
              for (const id in data[category]) {
                const value = data[category][id];
                const key = `${category}-${id}`;
                if (value) {
                  keys[key] = value;
                } else {
                  delete keys[key];
                }
              }
            }
            // Não aguardamos o salvamento aqui no SET, Baileys chamará saveCreds no creds.update
          }
        }
      },
      saveCreds,
    };
  }
}
