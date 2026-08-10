Arquitetura de FinOps, Custo-Eficiência e Gerenciamento de Tokens
Este documento especifica a estratégia de FinOps, Eficiência Financeira e Gerenciamento de Tokens do VendoraAI. Para que a plataforma opere de forma sustentável sob um modelo de SaaS Recorrente de Baixo Custo para PMEs, a engenharia do sistema deve garantir que o custo das APIs de Inteligência Artificial e de infraestrutura física seja estritamente controlado.

Este documento estabelece os mecanismos de orquestração financeira, técnicas de redução de tokens, roteamento dinâmico de modelos e o controle rígido de cotas para cumprir o requisito de eficiência financeira (RNF-08), que estipula que o custo de consumo de APIs de IA por cliente não deve exceder 15% do valor da mensalidade do plano contratado.

1. Princípios e Metas de FinOps (SaaS para PMEs)
O modelo SaaS para pequenas e médias empresas opera com margens unitárias que exigem disciplina severa na alocação de custos de computação e inteligência. A infraestrutura e a lógica de orquestração de IA do VendoraAI baseiam-se em quatro pilares financeiros:

                          ┌─────────────────────────────┐
                          │   Princípios de FinOps de   │
                          │          VendoraAI          │
                          └──────────────┬──────────────┘
                                         │
         ┌───────────────────────┬───────┴───────┬───────────────────────┐
         ▼                       ▼               ▼                       ▼
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│ Zero-Idle Infra │     │  Token Saving   │     │  Zero-Egress    │     │ Single-Database │
│ ECS Fargate /   │     │ Compacting &    │     │ Cloudflare R2   │     │ PostgreSQL +    │
│ CDN Estática    │     │ Context Cache   │     │ Eliminates Network│    │ pgvector        │
│ Reduces Costs   │     │ Saves up to 80% │     │ Transfer Costs  │     │ Saves $100/mo   │
└─────────────────┘     └─────────────────┘     └─────────────────┘     └─────────────────┘
Infraestrutura com Desperdício Zero (Zero-Idle):
Frontend Estático: A Single Page Application (SPA) é servida inteiramente via redes CDN globais de custo desprezível (como Cloudflare Pages), resultando em custo e consumo de CPU zero no servidor.
Backend Autoscale-to-Zero: O Backend Core roda sob containers serverless (AWS ECS Fargate), que escalam dinamicamente com base nas requisições, evitando o custo fixo de servidores ociosos durante períodos sem tráfego comercial (como madrugadas).
Minimização Agressiva de Tokens (Token-Saving):
Processamento e filtragem de conversas em nível de aplicação antes de enviar qualquer payload para LLMs parceiras.
Compactação semântica e truncamento de históricos para manter prompts curtos e focados na tarefa de conversão de leads.
Taxa Zero de Egresso (Zero-Egress Object Storage):
Hospedagem de áudios brutos do WhatsApp (para transcrição) e imagens de comprovantes no Cloudflare R2. Como a Cloudflare possui egress fees nulas, eliminamos até 90% das cobranças tradicionais de tráfego de rede observadas no AWS S3 tradicional.
Banco de Dados Unificado (Single-Database Strategy):
Armazenamento relacional e vetorial consolidado sob a mesma instância do PostgreSQL utilizando pgvector. Isso evita o custo fixo adicional de US$ 50 a US$ 100/mês por ambiente que um banco vetorial especializado (como Pinecone) imporia.
2. Metas de Margem por Plano de Assinatura
Para suportar as metas financeiras estabelecidas pelo produto, o custo médio do consumo de tokens de inteligência artificial de cada Tenant é limitado a um teto mensal com base na receita recorrente mensal (MRR) do seu plano correspondente:

Plano	MRR Sugerido (BRL)	Custo Teto IA / Mês (15% RNF-08)	Custo Máximo IA / Lead Atendido	Estratégia de IA Aplicada
Starter	R$ 149,00	R$ 22,35	R$ 0,22 (limite 100 leads)	Fase 1 e 2 (Análise semântica passiva de perdas, SLA e alertas de resfriamento em lote).
Growth	R$ 299,00	R$ 44,85	R$ 0,14 (limite 300 leads)	Fase 3 (Análise ativa, RAG para sugestões de respostas rápidas com preenchimento de campos).
Enterprise	R$ 999,00	R$ 149,85	R$ 0,09 (limite 1500 leads)	Fase 4 (Agentes autônomos com roteiros completos de conversação, qualificação e agendamentos).
Nota: Os limites são controlados dinamicamente com base em buffers de segurança no backend, garantindo que o lojista receba avisos antes que a sua franquia de IA seja esgotada.

3. Modelo de Custo Unitário por Transação de IA
O custo de operação de IA é fragmentado por cada ação sistêmica executada nas conversas de WhatsApp. A tabela abaixo detalha as projeções financeiras unitárias baseadas no Google Gemini 1.5 Flash (modelo primário de inferência do sistema) e text-embedding-004:

Ação Sistêmica	Frequência por Mensagem	Volume de Tokens (Entrada)	Volume de Tokens (Saída)	Custo Unitário Estimado (USD)	Custo Unitário Estimado (BRL)
Geração de Embedding	1x por mensagem do lead	100 tokens (média)	N/A	$0.0000025 (Embedding)	R$ 0.000014
Classificação Semântica	1x por fechamento/perda	600 tokens (histórico curto)	120 tokens (JSON)	$0.000075 (Flash) + $0.000036 (Flash)	R$ 0.00062
RAG: Sugestão de Resposta	Opcional (vendedor aciona)	1.800 tokens (chunks + histórico)	250 tokens (rascunho)	$0.000135 (Flash) + $0.000075 (Flash)	R$ 0.00117
Agente Autônomo (Fase 4)	1x por mensagem recebida	2.500 tokens (Contexto do lead)	150 tokens (resposta curta)	$0.000187 (Flash) + $0.000045 (Flash)	R$ 0.00130
Análise de Viabilidade Financeira:
Sob um cenário típico no plano Growth (R$ 299,00/mês), um lojista atende em média 250 leads ativos por mês. Se cada lead gera uma média de 10 mensagens, e o vendedor solicita sugestões do RAG para 30% dessas mensagens, o consumo estimado de custos de IA consolida-se em:

Embeddings: $250 \times 10 \times \text{R$} 0,000014 = \text{R$} 0,035$
Classificações: $250 \times 1 \times \text{R$} 0,00062 = \text{R$} 0,155$
RAG Sugestões: $250 \times 3 \times \text{R$} 0,00117 = \text{R$} 0,877$
Custo IA Mensal Total do Tenant: R$ 1,067 (Muito abaixo do teto de R$ 44,85 do plano Growth).
Margem Financeira Real: A margem operacional de IA neste cenário é de 96.4% em relação ao orçamento disponível para o Tenant, gerando excelente margem de lucro para o SaaS.
4. Técnicas de Otimização e Compressão de Contexto (Token-Saving)
O maior vetor de aumento de custos em sistemas que processam conversas do WhatsApp é o crescimento linear e descontrolado do histórico de mensagens enviado como contexto às LLMs. O VendoraAI implementa três camadas de proteção para evitar o "estofamento" (context stuffing) de tokens:

  📥 payload do webhook (conversas brutas)
                 │
                 ▼
 ┌──────────────────────────────┐
 │  Camada 1: Limpeza Sintática │ ──► Remove emojis repetidos, saudações
 └──────────────┬───────────────┘     e metadados inúteis de formatação.
                │
                ▼
 ┌──────────────────────────────┐
 │ Camada 2: Memória Episódica  │ ──► Mantém apenas as últimas N mensagens
 └──────────────┬───────────────┘     relevantes de forma deslizante.
                │
                ▼
 ┌──────────────────────────────┐
 │ Camada 3: Resumos Semânticos │ ──► Condensa trechos antigos em um único
 └──────────────┬───────────────┘     parágrafo de resumo narrativo de IA.
                │
                ▼
  🧠 prompt final enxuto (economia de até 80% de tokens)
4.1. Limpeza Sintática Local
Antes de enviar qualquer texto para APIs de Embeddings ou LLMs, o backend processa a mensagem para:

Remover múltiplos espaços em branco, caracteres de controle invisíveis e quebras de linha repetitivas.
Filtrar assinaturas automáticas de mensagens de sistemas de atendimento.
Limitar o tamanho total de caracteres aceito por mensagem individual a no máximo 1.000 caracteres (descartando textos gigantescos ou payloads corrompidos enviados de forma maliciosa).
4.2. Janela de Mensagens Deslizante (Memória Episódica)
A aplicação nunca envia o histórico completo de uma conversa longa de dias para sugerir uma resposta rápida. O histórico é filtrado localmente na memória RAM do NodeJS utilizando uma estratégia de janela deslizante:

Conversa Ativa recente: Envia apenas as últimas 6 mensagens brutas trocadas nas últimas 2 horas.
Mensagens Administrativas: Ignora mensagens do tipo "Lead transferido para vendedor X" ou "Aguardando atendimento" na contagem de contexto da LLM, pois não agregam valor semântico para a sugestão de resposta do agente comercial.
4.3. Compactação por Resumos Semânticos (Memória de Longo Prazo)
Para conversas longas ou recorrentes que excedem 20 mensagens, o sistema executa um processo de condensação automática:

Um job assíncrono detecta conversas extensas.
O backend envia as mensagens mais antigas para o Gemini 1.5 Flash com um prompt especializado: "Resuma a intenção de compra, objeções encontradas e o status atual deste diálogo em até 3 frases."
O resumo resultante é salvo na tabela Lead do banco de dados (campo conversational_summary).
Nas requisições subsequentes de RAG ou Agentes Autônomos, o histórico bruto antigo é descartado e o prompt é estruturado injetando apenas o conversational_summary (parágrafo de resumo) + as últimas 6 mensagens ativas do lead. Isso resulta em uma redução de até 80% no consumo total de tokens de entrada sem perda de precisão contextual.
5. Roteamento Dinâmico de Custos de IA (Model Routing)
Para equilibrar resiliência com custos mínimos de tokens, o Vercel AI SDK é utilizado como uma camada de abstração multimodelo de baixo acoplamento. O sistema chaveia dinamicamente as chamadas de inferência com base no tamanho, complexidade e limites de cota:

// Exemplo de Provedor e Configuração de Roteamento Baseado em FinOps
import { google } from '@ai-sdk/google';
import { openai } from '@ai-sdk/openai';
import { LanguageModel } from 'ai';

export class ModelRouter {
  /**
   * Retorna o modelo ideal com base na tarefa e severidade de custos
   */
  static getModel(task: 'classification' | 'rag_draft' | 'autonomous_agent', tenantTier: string): LanguageModel {
    // 1. Tarefas básicas de classificação de perdas semânticas e extração
    if (task === 'classification') {
      return google('gemini-1.5-flash'); // Menor custo de classificação do mercado
    }

    // 2. Tarefas de geração de rascunhos com RAG para planos Starter/Growth
    if (task === 'rag_draft' && tenantTier !== 'ENTERPRISE') {
      return google('gemini-1.5-flash'); // Prioriza o Gemini 1.5 Flash por custo-benefício
    }

    // 3. Tarefas de alta fidelidade e agentes comerciais autônomos (Plano Enterprise)
    if (task === 'autonomous_agent') {
      // Retorna o Gemini 1.5 Flash pela velocidade, mas permite chaveamento para o GPT-4o-mini
      // caso o lojista prefira maior consistência estrutural em chamadas paralelas
      return google('gemini-1.5-flash');
    }

    return google('gemini-1.5-flash'); // Default padrão FinOps
  }

  /**
   * Modelo de fallback em caso de erros de quota (HTTP 429) ou indisponibilidade
   */
  static getFallbackModel(): LanguageModel {
    return openai('gpt-4o-mini'); // Fallback resiliente com custo equivalente ao Flash
  }
}
6. Monitoramento de Custos e Alocação por Tenant (Cost Tracking)
O VendoraAI implementa um sistema rígido de Alocação de Custos em Tempo Real na camada de aplicação. Isso impede o comportamento de "AI Runaway" (loops infinitos de chamadas que poderiam gerar prejuízos financeiros severos ao SaaS).

6.1. O Mecanismo de Coleta e Logging (FinOps Interceptor)
Cada requisição processada pelo orquestrador de IA captura as métricas físicas de uso retornadas pelas APIs (como promptTokens, completionTokens e totalTokens). O Interceptor mapeia esses valores para a moeda local (BRL) multiplicando os tokens pelos valores tabelados de cada modelo e salva os dados de forma atômica no banco de dados.

// Implementação do Serviço de Auditoria de Consumo e Billing de IA
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class IaBillingService {
  constructor(private readonly prisma: PrismaService) {}

  // Preço por 1 milhão de tokens (Valores de Referência do Gemini 1.5 Flash)
  private readonly GEMINI_FLASH_INPUT_COST_USD = 0.075;
  private readonly GEMINI_FLASH_OUTPUT_COST_USD = 0.30;
  private readonly DOLAR_TAXA_CAMBIO = 5.60; // Configurado dinamicamente via cache de moedas

  /**
   * Registra o consumo real e calcula o custo em BRL para auditoria por Tenant
   */
  async logUsage(
    tenantId: string,
    model: string,
    promptTokens: number,
    completionTokens: number,
    action: string
  ): Promise<number> {
    // 1. Calcula o custo em USD com base nas taxas do provedor
    const inputCostUsd = (promptTokens / 1_000_000) * this.GEMINI_FLASH_INPUT_COST_USD;
    const outputCostUsd = (completionTokens / 1_000_000) * this.GEMINI_FLASH_OUTPUT_COST_USD;
    const totalCostUsd = inputCostUsd + outputCostUsd;

    // 2. Converte para a moeda local (BRL)
    const totalCostBrl = totalCostUsd * this.DOLAR_TAXA_CAMBIO;

    // 3. Persiste o uso físico e financeiro de forma atômica para relatórios
    await this.prisma.usageLog.create({
      data: {
        tenantId,
        model,
        action,
        promptTokens,
        completionTokens,
        costBrl: totalCostBrl,
      },
    });

    return totalCostBrl;
  }

  /**
   * Verifica se o Tenant possui limite disponível para realizar chamadas de IA
   */
  async hasAvailableQuota(tenantId: string): Promise<boolean> {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    // 1. Coleta a soma de gastos acumulados do Tenant no mês vigente
    const usageSum = await this.prisma.usageLog.aggregate({
      where: {
        tenantId,
        createdAt: { gte: startOfMonth },
      },
      _sum: {
        costBrl: true,
      },
    });

    const currentSpent = usageSum._sum.costBrl || 0;

    // 2. Busca a regra de cobrança e o teto limite do plano do Tenant
    const billingRule = await this.prisma.billingRule.findUnique({
      where: { tenantId },
    });

    if (!billingRule) {
      return false; // Bloqueia por segurança se não houver plano registrado
    }

    // 3. Permite a chamada se o gasto acumulado for inferior ao teto de segurança
    return currentSpent < billingRule.maxIaCostBrl;
  }
}
6.2. Throttling e Throttling Inteligente
Caso o Tenant atinja 80% do limite mensal estipulado para o seu plano:

O backend emite uma notificação em tempo real via WebSockets para a interface do vendedor: "Atenção: Sua cota de sugestões de IA está próxima do limite (80% consumido). Deseja expandir sua franquia?".
Caso atinja 100% do limite mensal, as funcionalidades de IA ativa (como sugestões de rascunhos RAG e triagem autônoma) são suspensas dinamicamente para o Tenant, e a interface entra em modo de degradação suave:
O sistema continua recebendo e organizando as mensagens do WhatsApp.
O cálculo de SLA de resposta continua funcionando normalmente (pois roda 100% no servidor NodeJS sem custo de APIs externas).
O vendedor continua conseguindo digitar e enviar mensagens manualmente sem interrupções de canais.
As sugestões automáticas de IA ficam temporariamente indisponíveis até a virada de faturamento ou contratação de franquia incremental pelo lojista, cumprindo com segurança jurídica e estabilidade sistêmica o teto financeiro do negócio.
7. Práticas de FinOps Continuadas e Monitoramento do Grafana
Para garantir o sucesso financeiro da operação e o cumprimento de metas de lucratividade em produção, o sistema expõe painéis específicos para o time de gestão operacional no Grafana:

Dashboard de Margem Bruta: Gráfico comparativo entre o faturamento total recebido de assinaturas de Tenants (via Webhook da Stripe/Asaas) contra o custo real consolidado de APIs do Google Gemini/OpenAI de saída.
Distribuição de Custo por Tenant: Gráfico que lista quais Tenants estão consumindo o maior volume financeiro de tokens, permitindo a detecção precoce de possíveis clientes abusivos para ajuste de planos.
Métrica de Token Efficiency: Relação matemática entre o total de mensagens tratadas pelo sistema contra a quantidade de tokens consumida por lead, mapeando a eficácia e acurácia dos algoritmos de compressão de contexto e resumos semânticos.