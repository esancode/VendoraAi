import { Test, TestingModule } from '@nestjs/testing';
import { KnowledgeService } from './knowledge.service';
import { PrismaService } from '../prisma/prisma.service';

// Mock the AI SDK to avoid real API calls during tests
jest.mock('ai', () => ({
  embed: jest.fn().mockImplementation(async ({ value }) => {
    // Generate a dummy 768-d vector
    const dummyVector = Array(768).fill(0).map((_, i) => (value.includes('troca') ? 0.9 : 0.1));
    return { embedding: dummyVector };
  }),
  embedMany: jest.fn().mockImplementation(async ({ values }) => {
    const embeddings = values.map((val: string) => 
      Array(768).fill(0).map(() => (val.includes('troca') ? 0.9 : 0.1))
    );
    return { embeddings };
  }),
}));

jest.mock('@ai-sdk/google', () => ({
  google: {
    textEmbeddingModel: jest.fn().mockReturnValue('mocked-model'),
  },
}));

describe('KnowledgeService', () => {
  let service: KnowledgeService;
  let prisma: PrismaService;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [KnowledgeService, PrismaService],
    }).compile();

    service = module.get<KnowledgeService>(KnowledgeService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('chunkText', () => {
    it('deve quebrar um texto longo de 1200 caracteres respeitando o limite de 500 com overlap de 50', () => {
      // Gera um texto com 1200 caracteres sem espaços para forçar a quebra dura
      const text = 'A'.repeat(1200);
      
      const chunks = service.chunkText(text, 500, 50);
      
      // Valida o limite de caracteres por chunk
      chunks.forEach(chunk => {
        expect(chunk.length).toBeLessThanOrEqual(500);
      });

      // Valida o overlap
      // Chunk 1: indices 0 a 500 (length 500)
      // Chunk 2: indices 450 a 950 (length 500)
      // Chunk 3: indices 900 a 1200 (length 300)
      expect(chunks.length).toBe(3);
      expect(chunks[0].length).toBe(500);
      expect(chunks[1].length).toBe(500);
      expect(chunks[2].length).toBe(300);
    });
  });

  describe('E2E: Persistência e RLS na Busca Semântica', () => {
    let tenantAlfaId: string;
    let tenantBetaId: string;

    beforeAll(async () => {
      // Limpa os dados
      await prisma.knowledgeChunk.deleteMany();
      await prisma.knowledgeSource.deleteMany();
      await prisma.tenant.deleteMany();

      // Cria Tenants
      const alfa = await prisma.tenant.create({ data: { name: 'Ótica Alfa' } });
      const beta = await prisma.tenant.create({ data: { name: 'Ótica Beta' } });
      tenantAlfaId = alfa.id;
      tenantBetaId = beta.id;
      
      const agentAlfa = await prisma.agent.create({ data: { tenantId: tenantAlfaId, name: 'Agent Alfa', status: true, onboardingAnswers: {} } });
      const agentBeta = await prisma.agent.create({ data: { tenantId: tenantBetaId, name: 'Agent Beta', status: true, onboardingAnswers: {} } });
      
      // Cria fontes de conhecimento
      await service.createSource(tenantAlfaId, agentAlfa.id, 'FAQ Alfa', 'Regra de troca de lentes em até 15 dias');
      await service.createSource(tenantBetaId, agentBeta.id, 'FAQ Beta', 'Desconto Pix de 10% em armações');
    });

    it('deve retornar dados vazios ao buscar "troca" no Tenant Beta, garantindo isolamento RLS', async () => {
      // Busca "troca" no contexto da Alfa (espera encontrar)
      const agentAlfa = await prisma.agent.findFirst({ where: { tenantId: tenantAlfaId } });
      const alfaResults = await service.searchRelevantChunks(tenantAlfaId, agentAlfa!.id, 'troca', 3);
      expect(alfaResults.length).toBeGreaterThan(0);
      expect(alfaResults[0]).toContain('Regra de troca');

      // Busca "troca" no contexto da Beta (NÃO deve encontrar dados da Alfa)
      const agentBeta = await prisma.agent.findFirst({ where: { tenantId: tenantBetaId } });
      const betaResults = await service.searchRelevantChunks(tenantBetaId, agentBeta!.id, 'troca', 3);
      
      // O Tenant Beta tem a palavra "armações" e não "troca". E os dados da Alfa estão protegidos por RLS.
      // O mock do embedding retorna vetores similares, então se o RLS falhar, ele retornaria a FAQ da Alfa.
      const hasAlfaData = betaResults.some(r => r.includes('Regra de troca'));
      expect(hasAlfaData).toBe(false);
    });

    it('deve excluir a fonte e confirmar remoção em cascata dos chunks via RLS', async () => {
      // 1. Cadastra uma FAQ para um Tenant
      const agentAlfa = await prisma.agent.findFirst({ where: { tenantId: tenantAlfaId } });
      const sourceTitle = 'FAQ Temporária para Deletar';
      await service.createSource(tenantAlfaId, agentAlfa!.id, sourceTitle, 'Documento que deve ser apagado');

      // 2. Localiza o source recém-criado
      const createdSource = await prisma.knowledgeSource.findFirst({
        where: { title: sourceTitle, tenantId: tenantAlfaId }
      });
      expect(createdSource).toBeDefined();
      
      // 3. Valida que os chunks foram criados
      const chunksBefore = await prisma.knowledgeChunk.findMany({
        where: { sourceId: createdSource!.id }
      });
      expect(chunksBefore.length).toBeGreaterThan(0);

      // 4. Exclui a fonte via service (que usa RLS)
      await service.deleteSource(tenantAlfaId, agentAlfa!.id, createdSource!.id);

      // 5. Verifica se a fonte sumiu
      const sourceAfter = await prisma.knowledgeSource.findUnique({
        where: { id: createdSource!.id }
      });
      expect(sourceAfter).toBeNull();

      // 6. Confirma a exclusão física em cascata no pgvector (tabela knowledge_chunks)
      const chunksAfter = await prisma.knowledgeChunk.findMany({
        where: { sourceId: createdSource!.id }
      });
      expect(chunksAfter.length).toBe(0);
    });
  });
});
