/*
  Warnings:

  - You are about to drop the column `access_token` on the `whatsapp_channels` table. All the data in the column will be lost.
  - You are about to drop the column `connection_type` on the `whatsapp_channels` table. All the data in the column will be lost.
  - You are about to drop the column `phone_number_id` on the `whatsapp_channels` table. All the data in the column will be lost.
  - You are about to drop the column `waba_id` on the `whatsapp_channels` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('PENDING_VERIFICATION', 'ACTIVE', 'LOCKED');

-- DropIndex
DROP INDEX "whatsapp_channels_phone_number_id_key";

-- AlterTable
ALTER TABLE "tenants" ADD COLUMN     "onboarding_completed" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "avatar_url" VARCHAR(500),
ADD COLUMN     "status" "UserStatus" NOT NULL DEFAULT 'PENDING_VERIFICATION';

-- AlterTable
ALTER TABLE "whatsapp_channels" DROP COLUMN "access_token",
DROP COLUMN "connection_type",
DROP COLUMN "phone_number_id",
DROP COLUMN "waba_id",
ADD COLUMN     "name" VARCHAR(100) NOT NULL DEFAULT 'WhatsApp';
