import * as crypto from 'node:crypto';

export class CryptoHelper {
  private static getAlgorithm(): string {
    return 'aes-256-gcm';
  }

  private static getKey(): Buffer {
    const keyString = process.env.DATA_ENCRYPTION_KEY;
    if (!keyString || keyString.length !== 32) {
      throw new Error('A variável de ambiente DATA_ENCRYPTION_KEY não está configurada corretamente. Ela deve ter exatamente 32 bytes.');
    }
    return Buffer.from(keyString, 'utf8');
  }

  static encrypt(text: string): string {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv(this.getAlgorithm(), this.getKey(), iv) as crypto.CipherGCM;
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag().toString('hex');
    
    // Formato: iv:authTag:encryptedData
    return `${iv.toString('hex')}:${authTag}:${encrypted}`;
  }

  static decrypt(hash: string): string {
    if (!hash) return hash;
    
    const parts = hash.split(':');
    if (parts.length !== 3) {
      throw new Error('Formato de hash inválido. Esperado iv:authTag:encryptedData');
    }
    
    const [ivHex, authTagHex, encryptedHex] = parts;
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    
    const decipher = crypto.createDecipheriv(this.getAlgorithm(), this.getKey(), iv) as crypto.DecipherGCM;
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }
}
