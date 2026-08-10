/*
  Warnings:

  - Added the required column `agent_id` to the `knowledge_chunks` table without a default value. This is not possible if the table is not empty.
  - Added the required column `agent_id` to the `knowledge_sources` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "knowledge_chunks" ADD COLUMN     "agent_id" UUID NOT NULL;

-- AlterTable
ALTER TABLE "knowledge_sources" ADD COLUMN     "agent_id" UUID NOT NULL;

-- CreateIndex
CREATE INDEX "knowledge_chunks_agent_id_idx" ON "knowledge_chunks"("agent_id");

-- CreateIndex
CREATE INDEX "knowledge_sources_tenant_id_idx" ON "knowledge_sources"("tenant_id");

-- CreateIndex
CREATE INDEX "knowledge_sources_agent_id_idx" ON "knowledge_sources"("agent_id");

-- AddForeignKey
ALTER TABLE "knowledge_sources" ADD CONSTRAINT "knowledge_sources_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_chunks" ADD CONSTRAINT "knowledge_chunks_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
