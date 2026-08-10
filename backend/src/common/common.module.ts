import { Global, Module } from '@nestjs/common';
import { RedisService } from './services/redis.service';
import { MailService } from './services/mail.service';

@Global()
@Module({
  providers: [RedisService, MailService],
  exports: [RedisService, MailService],
})
export class CommonModule {}
