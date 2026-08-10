import { Test, TestingModule } from '@nestjs/testing';
import { EncryptionService } from './encryption.service';
import { InternalServerErrorException } from '@nestjs/common';

describe('EncryptionService', () => {
  let service: EncryptionService;
  const originalEnv = process.env;

  beforeEach(async () => {
    // Reset env
    process.env = { ...originalEnv };
    process.env.ENCRYPTION_MASTER_KEY = 'a'.repeat(64); // 32 bytes hex

    const module: TestingModule = await Test.createTestingModule({
      providers: [EncryptionService],
    }).compile();

    service = module.get<EncryptionService>(EncryptionService);
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should fail to initialize without a valid 64-char hex key', async () => {
    process.env.ENCRYPTION_MASTER_KEY = 'invalid';
    await expect(
      Test.createTestingModule({
        providers: [EncryptionService],
      }).compile()
    ).rejects.toThrow(InternalServerErrorException);
  });

  describe('encrypt and decrypt', () => {
    it('should encrypt and decrypt correctly', () => {
      const plaintext = 'Hello World';
      const encrypted = service.encrypt(plaintext);
      
      expect(encrypted).toContain(':');
      expect(encrypted.split(':').length).toBe(3); // iv, authTag, ciphertext
      expect(encrypted).not.toEqual(plaintext);
      
      const decrypted = service.decrypt(encrypted);
      expect(decrypted).toBe(plaintext);
    });

    it('should throw error if encrypted payload is tampered', () => {
      const plaintext = 'Sensitive Data';
      const encrypted = service.encrypt(plaintext);
      
      const parts = encrypted.split(':');
      // Tamper ciphertext
      parts[2] = parts[2].replace(/[0-9a-f]/i, (char) => char === '0' ? '1' : '0');
      const tampered = parts.join(':');
      
      expect(() => service.decrypt(tampered)).toThrow(/Decryption failed/);
    });

    it('should handle empty strings gracefully', () => {
      const plaintext = '';
      const encrypted = service.encrypt(plaintext);
      expect(encrypted).toBe('');
      const decrypted = service.decrypt(encrypted);
      expect(decrypted).toBe('');
    });
  });

  describe('encryptDeterministic', () => {
    it('should produce the same ciphertext for the same input', () => {
      const plaintext = '5511999999999';
      const encrypted1 = service.encryptDeterministic(plaintext);
      const encrypted2 = service.encryptDeterministic(plaintext);
      
      expect(encrypted1).toBe(encrypted2);
    });

    it('should produce different ciphertext for different inputs', () => {
      const encrypted1 = service.encryptDeterministic('input1');
      const encrypted2 = service.encryptDeterministic('input2');
      
      expect(encrypted1).not.toBe(encrypted2);
    });

    it('can be decrypted by the normal decrypt method', () => {
      const plaintext = 'Exact Match Data';
      const encrypted = service.encryptDeterministic(plaintext);
      
      const decrypted = service.decrypt(encrypted);
      expect(decrypted).toBe(plaintext);
    });
  });
});
