import { Module } from '@nestjs/common';
import { BillingController } from './billing.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { BillingService } from './billing.service';

@Module({
  imports: [PrismaModule],
  controllers: [BillingController],
  providers: [BillingService],
})
export class BillingModule {}
