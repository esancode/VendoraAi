import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { embed, embedMany } from 'ai';
import { google } from '@ai-sdk/google';

@Injectable()
export class KnowledgeService {
  private readonly logger = new Logger(KnowledgeService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Quebra o texto em blocos de até maxLen caracteres com um overlap.
   */
  public chunkText(text: string, maxLen = 500, overlap = 50): string[] {
    if (!text) return [];
    
    const chunks: string[] = [];
    let currentIdx = 0;

    while (currentIdx < text.length) {
      let endIdx = currentIdx + maxLen;
      
      if (endIdx < text.length) {
        // Tenta achar um espaço ou quebra de linha próximo ao final para quebrar de forma limpa
        const lastSpace = text.lastIndexOf(' ', endIdx);
        const lastNewline = text.lastIndexOf('\n', endIdx);
        const breakIdx = Math.max(lastSpace, lastNewline);
        
        // Se o último espaço encontrado não comprometer demais o tamanho do bloco (ex: mais da metade), use-o
        if (breakIdx > currentIdx + (maxLen / 2)) {
          endIdx = breakIdx;
        }
      } else {
        endIdx = text.length;
      }
      
      chunks.push(text.slice(currentIdx, endIdx).trim());
      
      if (endIdx >= text.length) break;
      
      currentIdx = endIdx - overlap;
    }
    
    return chunks.filter(c => c.length > 0);
  }

  async createSource(tenantId: string, agentId: string, title: string, content: string): Promise<void> {
    this.logger.debug(`Criando KnowledgeSource [${title}] para tenant [${tenantId}]`);
    const chunks = this.chunkText(content);
    
    if (chunks.length === 0) return;

    this.logger.debug(`Gerando embeddings para ${chunks.length} chunks`);
    let embeddings: number[][];
    
    if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
      this.logger.warn(`GOOGLE_GENERATIVE_AI_API_KEY no configurada. Usando embeddings dummy.`);
      embeddings = chunks.map(() => new Array(768).fill(0.0));
    } else {
      const response = await embedMany({
        model: google.textEmbeddingModel('text-embedding-004'),
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

      // Prisma Client não suporta inserção direta do array float[] para colunas vector.
      // É preciso usar queryRaw / executeRaw para converter para a tipagem do pgvector.
      for (let i = 0; i < chunks.length; i++) {
        const chunkContent = chunks[i];
        const embedding = embeddings[i];
        const vectorString = `[${embedding.join(',')}]`;

        await tx.$executeRaw`
          INSERT INTO knowledge_chunks (id, source_id, tenant_id, agent_id, content, embedding, created_at)
          VALUES (uuid_generate_v4(), ${source.id}::uuid, ${tenantId}::uuid, ${agentId}::uuid, ${chunkContent}, ${vectorString}::vector, NOW())
        `;
      }
    });
    
    this.logger.log(`KnowledgeSource e ${chunks.length} chunks inseridos com sucesso.`);
  }

  async searchRelevantChunks(tenantId: string, agentId: string, queryText: string, limit = 3): Promise<string[]> {
    this.logger.debug(`Buscando chunks relevantes para: "${queryText}"`);
    
    const { embedding } = await embed({
      model: google.textEmbeddingModel('text-embedding-004'),
      value: queryText,
    });

    const vectorString = `[${embedding.join(',')}]`;

    // O PostgreSQL aplica as políticas de RLS automaticamente baseadas na sessão (current_tenant_id),
    // blindando os dados antes da busca vetorial (otimizando a performance).
    const results = await this.prisma.runInTenantContext(tenantId, async (tx) => {
      return await tx.$queryRaw<{ content: string }[]>`
        SELECT content 
        FROM knowledge_chunks
        WHERE agent_id = ${agentId}::uuid
        ORDER BY embedding <=> ${vectorString}::vector
        LIMIT ${limit};
      `;
    });

    return results.map(r => r.content);
  }

  async deleteSource(tenantId: string, agentId: string, id: string): Promise<void> {
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
}
