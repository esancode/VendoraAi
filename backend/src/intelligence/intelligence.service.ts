import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { generateObject } from 'ai';
import { google } from '@ai-sdk/google';
import { z } from 'zod';

const ConsolidatedDemandsSchema = z.object({
  demands: z.array(z.object({
    categoria: z.string().describe('Nome padronizado da categoria de produto ou serviço'),
    quantidade: z.number().describe('Quantidade de intenções mapeadas sob essa categoria')
  }))
});

@Injectable()
export class IntelligenceService {
  private readonly logger = new Logger(IntelligenceService.name);

  constructor(private readonly prisma: PrismaService) {}

  async consolidateDemands(tenantId: string, startDate: Date, endDate: Date) {
    this.logger.log(`Consolidando demandas para o tenant ${tenantId} de ${startDate.toISOString()} até ${endDate.toISOString()}`);
    
    // Busca conversas no período
    const conversations = await this.prisma.conversation.findMany({
      where: {
        tenantId,
        createdAt: { gte: startDate, lte: endDate },
      },
      select: { unmappedDemands: true }
    });

    const allDemands: string[] = [];
    
    for (const conv of conversations) {
      if (conv.unmappedDemands && conv.unmappedDemands.length > 0) {
        allDemands.push(...conv.unmappedDemands);
      }
    }

    if (allDemands.length === 0) return [];

    const systemPrompt = `
      Você é um analista de negócios e inteligência de mercado.
      Foi fornecida uma lista bruta de desejos de consumo não atendidos mencionados por clientes.
      Sua tarefa é agrupar essas demandas semanticamente similares sob nomes de categorias de produtos 
      ou serviços normalizados de mercado e classificar a volumetria aproximada de interesse.
    `;

    try {
      this.logger.debug('Agrupando demandas com gemini-1.5-flash');
      const { object } = await generateObject({
        model: google('gemini-1.5-flash'),
        schema: ConsolidatedDemandsSchema,
        system: systemPrompt,
        prompt: `Lista bruta de demandas encontradas:\n${JSON.stringify(allDemands)}`,
      });

      return object.demands;
    } catch (error) {
      this.logger.error(`Falha ao consolidar demandas: ${error.message}`);
      return [];
    }
  }
}
