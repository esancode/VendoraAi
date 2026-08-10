import { Test, TestingModule } from '@nestjs/testing';
import { WhatsappQrCodeService } from './whatsapp-qrcode.service';
import { PrismaService } from '../prisma/prisma.service';
import { EncryptionService } from '../security/encryption.service';
import { NotificationGateway } from '../notifications/notification.gateway';
import { getQueueToken } from '@nestjs/bullmq';
import { ConnectionStatus } from '@prisma/client';
import * as Baileys from '@whiskeysockets/baileys';

// Mock Baileys module
jest.mock('@whiskeysockets/baileys', () => {
  return {
    __esModule: true,
    default: jest.fn().mockReturnValue({
      ev: { on: jest.fn() },
      logout: jest.fn().mockResolvedValue(undefined),
      ws: { close: jest.fn() },
    }),
    fetchLatestBaileysVersion: jest.fn().mockResolvedValue({ version: '1.0.0', isLatest: true }),
    initAuthCreds: jest.fn().mockReturnValue({}),
    BufferJSON: { reviver: jest.fn(), replacer: jest.fn() },
  };
});

describe('WhatsappQrCodeService', () => {
  let service: WhatsappQrCodeService;
  let prisma: PrismaService;
  let encryption: EncryptionService;

  beforeEach(async () => {
    const mockPrisma = {
      whatsAppChannel: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      runInTenantContext: jest.fn((tenantId, cb) => cb(mockPrisma)),
    };

    const mockEncryption = {
      encrypt: jest.fn((data) => `encrypted_${data}`),
      decrypt: jest.fn((data) => data.replace('encrypted_', '')),
    };

    const mockNotificationGateway = {
      broadcastToTenant: jest.fn(),
    };

    const mockIngestionQueue = {
      add: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WhatsappQrCodeService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: EncryptionService, useValue: mockEncryption },
        { provide: NotificationGateway, useValue: mockNotificationGateway },
        { provide: getQueueToken('whatsapp-ingestion'), useValue: mockIngestionQueue },
      ],
    }).compile();

    service = module.get<WhatsappQrCodeService>(WhatsappQrCodeService);
    prisma = module.get<PrismaService>(PrismaService);
    encryption = module.get<EncryptionService>(EncryptionService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Session Initialization', () => {
    it('should initialize Baileys socket and load auth state from db', async () => {
      const channelId = 'channel_123';
      const tenantId = 'tenant_123';
      
      const mockChannel = {
        id: channelId,
        connectionType: 'QRCODE',
        sessionData: `encrypted_{"creds": {"myId": "test"}, "keys": {}}`,
      };
      
      (prisma.whatsAppChannel.findUnique as jest.Mock).mockResolvedValue(mockChannel);
      
      await service.initializeSession(tenantId, channelId);

      expect(encryption.decrypt).toHaveBeenCalledWith(mockChannel.sessionData);
      expect(prisma.whatsAppChannel.update).toHaveBeenCalledWith({
        where: { id: channelId },
        data: { connectionStatus: ConnectionStatus.CONNECTING },
      });
      expect(Baileys.default).toHaveBeenCalled(); // makeWASocket
    });
  });

  describe('Session Disconnection', () => {
    it('should clear session from memory and db', async () => {
      const channelId = 'channel_123';
      const tenantId = 'tenant_123';
      
      await service.disconnectSession(tenantId, channelId);

      expect(prisma.runInTenantContext).toHaveBeenCalled();
      expect(prisma.whatsAppChannel.update).toHaveBeenCalledWith({
        where: { id: channelId },
        data: {
          connectionStatus: ConnectionStatus.DISCONNECTED,
          sessionData: null,
        },
      });
    });
  });

  describe('comparePhoneNumbers', () => {
    it('should match identical numbers', () => {
      expect(service.comparePhoneNumbers('5511999999999', '5511999999999')).toBe(true);
      expect(service.comparePhoneNumbers('+1234567890', '1234567890@s.whatsapp.net')).toBe(true);
    });

    it('should ignore 9th digit differences for Brazilian numbers (+55)', () => {
      // Reg with 9, Scan without 9
      expect(service.comparePhoneNumbers('5511988887777', '551188887777@s.whatsapp.net')).toBe(true);
      // Reg without 9, Scan with 9
      expect(service.comparePhoneNumbers('551188887777', '5511988887777:2@s.whatsapp.net')).toBe(true);
    });

    it('should fail on different brazilian area codes (DDD)', () => {
      expect(service.comparePhoneNumbers('5511988887777', '5521988887777@s.whatsapp.net')).toBe(false);
    });

    it('should fail on completely different numbers', () => {
      expect(service.comparePhoneNumbers('5511999999999', '5511911111111')).toBe(false);
      expect(service.comparePhoneNumbers('12345', '54321')).toBe(false);
    });
  });
});
