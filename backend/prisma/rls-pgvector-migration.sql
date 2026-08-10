-- Habilitação de extensões
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Criação de índice vetorial HNSW
CREATE INDEX ON message_embeddings USING hnsw (embedding vector_cosine_ops);

-- Habilitação do Row-Level Security (RLS)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_embeddings ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_logs ENABLE ROW LEVEL SECURITY;

-- Definição da política de barreira de acesso multi-tenant atômica
-- A política verifica se o usuário do banco é superusuário/bypass (postgres) ou 
-- se a variável app.current_tenant_id bate com a coluna tenant_id.

CREATE POLICY tenant_isolation_policy ON users
    USING (
        current_user = 'postgres' OR 
        tenant_id = current_setting('app.current_tenant_id', true)::uuid
    );

CREATE POLICY tenant_isolation_policy ON leads
    USING (
        current_user = 'postgres' OR 
        tenant_id = current_setting('app.current_tenant_id', true)::uuid
    );

CREATE POLICY tenant_isolation_policy ON conversations
    USING (
        current_user = 'postgres' OR 
        tenant_id = current_setting('app.current_tenant_id', true)::uuid
    );

CREATE POLICY tenant_isolation_policy ON messages
    USING (
        current_user = 'postgres' OR 
        tenant_id = current_setting('app.current_tenant_id', true)::uuid
    );

CREATE POLICY tenant_isolation_policy ON message_embeddings
    USING (
        current_user = 'postgres' OR 
        tenant_id = current_setting('app.current_tenant_id', true)::uuid
    );

CREATE POLICY tenant_isolation_policy ON billing_rules
    USING (
        current_user = 'postgres' OR 
        tenant_id = current_setting('app.current_tenant_id', true)::uuid
    );

CREATE POLICY tenant_isolation_policy ON usage_logs
    USING (
        current_user = 'postgres' OR 
        tenant_id = current_setting('app.current_tenant_id', true)::uuid
    );
