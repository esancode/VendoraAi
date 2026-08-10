import { Module } from '@nestjs/common';
import { EncryptionService } from './encryption.service';
import { SanitizerService } from './sanitizer.service';
import { GuardrailService } from './guardrail.service';

@Module({
  providers: [EncryptionService, SanitizerService, GuardrailService],
  exports: [EncryptionService, SanitizerService, GuardrailService],
})
export class SecurityModule {}
