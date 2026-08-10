import { Injectable } from '@nestjs/common';
import * as argon2 from 'argon2';

@Injectable()
export class PasswordHasherService {
  async hash(password: string): Promise<string> {
    const isTest = process.env.NODE_ENV === 'test';
    return argon2.hash(password, {
      type: argon2.argon2id,
      memoryCost: isTest ? 4096 : 65536,
      timeCost: isTest ? 1 : 3,
      parallelism: isTest ? 1 : 4,
    });
  }

  async compare(hash: string, password_raw: string): Promise<boolean> {
    try {
      return await argon2.verify(hash, password_raw);
    } catch (error) {
      return false; // return false for invalid hashes (like 'oauth_managed') instead of crashing
    }
  }
}
