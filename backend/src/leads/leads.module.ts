import { Module } from '@nestjs/common';
import { LeadsController } from './leads.controller';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [AuthModule, PrismaModule],
  controllers: [LeadsController],
})
export class LeadsModule {}
