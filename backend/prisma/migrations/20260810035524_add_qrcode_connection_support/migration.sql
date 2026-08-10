-- CreateEnum
CREATE TYPE "ConnectionStatus" AS ENUM ('DISCONNECTED', 'CONNECTING', 'QR_READY', 'CONNECTED');

-- CreateEnum
CREATE TYPE "ConnectionType" AS ENUM ('META_API', 'QRCODE');

-- AlterTable
ALTER TABLE "whatsapp_channels" ADD COLUMN     "connection_status" "ConnectionStatus" NOT NULL DEFAULT 'DISCONNECTED',
ADD COLUMN     "connection_type" "ConnectionType" NOT NULL DEFAULT 'META_API',
ADD COLUMN     "session_data" TEXT,
ALTER COLUMN "phone_number_id" DROP NOT NULL;
