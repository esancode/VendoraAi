-- AlterTable
ALTER TABLE "conversations" ADD COLUMN     "confidence_score" DECIMAL(5,4);

-- AlterTable
ALTER TABLE "leads" ADD COLUMN     "needs_human_review" BOOLEAN NOT NULL DEFAULT false,
ALTER COLUMN "name" SET DATA TYPE VARCHAR(255),
ALTER COLUMN "phone" SET DATA TYPE VARCHAR(255);

-- CreateTable
CREATE TABLE "agents" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "tenant_id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "status" BOOLEAN NOT NULL DEFAULT true,
    "onboardingAnswers" JSONB NOT NULL,
    "basePrompt" TEXT,
    "temperature" DECIMAL(2,1) NOT NULL DEFAULT 0.7,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "agents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_examples" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "agent_id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "user_query" TEXT NOT NULL,
    "expected_response" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agent_examples_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "agents_tenant_id_key" ON "agents"("tenant_id");

-- CreateIndex
CREATE INDEX "agent_examples_tenant_id_idx" ON "agent_examples"("tenant_id");

-- AddForeignKey
ALTER TABLE "agents" ADD CONSTRAINT "agents_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_examples" ADD CONSTRAINT "agent_examples_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Enable RLS on agents
ALTER TABLE "agents" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_agents ON "agents";
CREATE POLICY tenant_isolation_agents ON "agents"
    FOR ALL
    TO app_user
    USING ("tenant_id" = current_setting('app.current_tenant_id', true)::uuid);

-- Enable RLS on agent_examples
ALTER TABLE "agent_examples" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_agent_examples ON "agent_examples";
CREATE POLICY tenant_isolation_agent_examples ON "agent_examples"
    FOR ALL
    TO app_user
    USING ("tenant_id" = current_setting('app.current_tenant_id', true)::uuid);

-- Grants
GRANT USAGE ON SCHEMA public TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "agents" TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "agent_examples" TO app_user;
