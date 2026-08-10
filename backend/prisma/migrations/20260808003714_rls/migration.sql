-- DropIndex
DROP INDEX "message_embeddings_embedding_idx";

DO $$ BEGIN IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'app_user') THEN CREATE ROLE app_user; END IF; END $$; 
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user;