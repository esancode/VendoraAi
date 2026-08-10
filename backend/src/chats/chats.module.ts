import { Module } from '@nestjs/common';
import { ChatsController } from './chats.controller';
import { ChatsService } from './chats.service';
import { PrismaModule } from '../prisma/prisma.module';
import { IntelligenceModule } from '../intelligence/intelligence.module';

@Module({
  imports: [PrismaModule, IntelligenceModule],
  controllers: [ChatsController],
  providers: [ChatsService],
  exports: [ChatsService],
})
export class ChatsModule {}
