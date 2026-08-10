-- DropIndex
DROP INDEX "agents_tenant_id_key";

-- AlterTable
ALTER TABLE "conversations" ADD COLUMN     "unmapped_demands" TEXT[];

-- AlterTable
ALTER TABLE "leads" ADD COLUMN     "conversational_summary" TEXT;

-- CreateTable
CREATE TABLE "whatsapp_channels" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "tenant_id" UUID NOT NULL,
    "phone_number" VARCHAR(20) NOT NULL,
    "phone_number_id" VARCHAR(50) NOT NULL,
    "waba_id" VARCHAR(50),
    "access_token" TEXT,
    "agent_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "whatsapp_channels_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "whatsapp_channels_phone_number_key" ON "whatsapp_channels"("phone_number");

-- CreateIndex
CREATE UNIQUE INDEX "whatsapp_channels_phone_number_id_key" ON "whatsapp_channels"("phone_number_id");

-- CreateIndex
CREATE UNIQUE INDEX "whatsapp_channels_agent_id_key" ON "whatsapp_channels"("agent_id");

-- CreateIndex
CREATE INDEX "whatsapp_channels_tenant_id_idx" ON "whatsapp_channels"("tenant_id");

-- CreateIndex
CREATE INDEX "agents_tenant_id_idx" ON "agents"("tenant_id");

-- AddForeignKey
ALTER TABLE "whatsapp_channels" ADD CONSTRAINT "whatsapp_channels_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "whatsapp_channels" ADD CONSTRAINT "whatsapp_channels_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Habilitar RLS em whatsapp_channels
ALTER TABLE "whatsapp_channels" ENABLE ROW LEVEL SECURITY;

-- Criar política de RLS para whatsapp_channels baseada na app.current_tenant_id
CREATE POLICY "tenant_isolation_whatsapp_channels" ON "whatsapp_channels"
    AS PERMISSIVE FOR ALL
    TO public
    USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
    WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);
