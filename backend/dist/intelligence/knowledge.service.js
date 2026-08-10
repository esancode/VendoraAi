"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var KnowledgeService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.KnowledgeService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const ai_1 = require("ai");
const google_1 = require("@ai-sdk/google");
let KnowledgeService = KnowledgeService_1 = class KnowledgeService {
    prisma;
    logger = new common_1.Logger(KnowledgeService_1.name);
    constructor(prisma) {
        this.prisma = prisma;
    }
    chunkText(text, maxLen = 500, overlap = 50) {
        if (!text)
            return [];
        const chunks = [];
        let currentIdx = 0;
        while (currentIdx < text.length) {
            let endIdx = currentIdx + maxLen;
            if (endIdx < text.length) {
                const lastSpace = text.lastIndexOf(' ', endIdx);
                const lastNewline = text.lastIndexOf('\n', endIdx);
                const breakIdx = Math.max(lastSpace, lastNewline);
                if (breakIdx > currentIdx + (maxLen / 2)) {
                    endIdx = breakIdx;
                }
            }
            else {
                endIdx = text.length;
            }
            chunks.push(text.slice(currentIdx, endIdx).trim());
            if (endIdx >= text.length)
                break;
            currentIdx = endIdx - overlap;
        }
        return chunks.filter(c => c.length > 0);
    }
    async createSource(tenantId, agentId, title, content) {
        this.logger.debug(`Criando KnowledgeSource [${title}] para tenant [${tenantId}]`);
        const chunks = this.chunkText(content);
        if (chunks.length === 0)
            return;
        this.logger.debug(`Gerando embeddings para ${chunks.length} chunks`);
        let embeddings;
        if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
            this.logger.warn(`GOOGLE_GENERATIVE_AI_API_KEY no configurada. Usando embeddings dummy.`);
            embeddings = chunks.map(() => new Array(768).fill(0.0));
        }
        else {
            const response = await (0, ai_1.embedMany)({
                model: google_1.google.textEmbeddingModel('text-embedding-004'),
                values: chunks,
            });
            embeddings = response.embeddings;
        }
        await this.prisma.runInTenantContext(tenantId, async (tx) => {
            const source = await tx.knowledgeSource.create({
                data: {
                    tenantId,
                    agentId,
                    title,
                    content,
                },
            });
            for (let i = 0; i < chunks.length; i++) {
                const chunkContent = chunks[i];
                const embedding = embeddings[i];
                const vectorString = `[${embedding.join(',')}]`;
                await tx.$executeRaw `
          INSERT INTO knowledge_chunks (id, source_id, tenant_id, agent_id, content, embedding, created_at)
          VALUES (uuid_generate_v4(), ${source.id}::uuid, ${tenantId}::uuid, ${agentId}::uuid, ${chunkContent}, ${vectorString}::vector, NOW())
        `;
            }
        });
        this.logger.log(`KnowledgeSource e ${chunks.length} chunks inseridos com sucesso.`);
    }
    async searchRelevantChunks(tenantId, agentId, queryText, limit = 3) {
        this.logger.debug(`Buscando chunks relevantes para: "${queryText}"`);
        const { embedding } = await (0, ai_1.embed)({
            model: google_1.google.textEmbeddingModel('text-embedding-004'),
            value: queryText,
        });
        const vectorString = `[${embedding.join(',')}]`;
        const results = await this.prisma.runInTenantContext(tenantId, async (tx) => {
            return await tx.$queryRaw `
        SELECT content 
        FROM knowledge_chunks
        WHERE agent_id = ${agentId}::uuid
        ORDER BY embedding <=> ${vectorString}::vector
        LIMIT ${limit};
      `;
        });
        return results.map(r => r.content);
    }
    async deleteSource(tenantId, agentId, id) {
        await this.prisma.runInTenantContext(tenantId, async (tx) => {
            const source = await tx.knowledgeSource.findUnique({
                where: { id, agentId },
            });
            if (!source) {
                throw new Error('Fonte de conhecimento não encontrada');
            }
            await tx.knowledgeSource.delete({
                where: { id },
            });
        });
    }
};
exports.KnowledgeService = KnowledgeService;
exports.KnowledgeService = KnowledgeService = KnowledgeService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], KnowledgeService);
//# sourceMappingURL=knowledge.service.js.map