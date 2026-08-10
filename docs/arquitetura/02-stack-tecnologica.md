Escolha da Stack Tecnológica (docs/arquitetura/02-stack-tecnologica.md)
Metadado	Detalhe
Versão	1.0
Status	Em planejamento
Escopo	Escolha, Justificativa e Análise de Trade-offs das Tecnologias
Autor	Arquiteto-Chefe
Data	Agosto de 2026
1. Introdução e Diretrizes da Stack
A escolha da stack tecnológica do VendoraAI baseia-se em um equilíbrio rigoroso entre velocidade de desenvolvimento (Developer Velocity), desempenho operacional bruto (SLA de Ingestão < 2s), baixo custo de infraestrutura (Cost-Efficiency) e segurança/privacidade de dados (Compliance LGPD) [50, 95].

Sob o princípio de Simplicidade Radical e operando no modelo SaaS Recorrente para PMEs, a arquitetura rejeita complexidades de infraestrutura prematuras (como dezenas de microsserviços ou múltiplos bancos de dados proprietários) [28, 86, 95]. Em vez disso, adotamos um padrão de Monólito Modular altamente otimizado para o Backend Core, desacoplado da camada de IA por mensageria assíncrona, e uma Single Page Application (SPA) leve e estática para o Frontend [95, 98].

2. Documentos de Contexto e Impactos
2.1. Documentos Anteriores que Impactam este Arquivo
docs/00-visao-geral.md (e 00-visao-geral.md de produto): Define o escopo de aplicação Web responsiva (SPA), eliminando aplicativos nativos na Fase 1 [23].
docs/01-roadmap.md: Exige uma stack capaz de escalar de forma invisível desde a análise passiva (Fase 1) até agentes autônomos orientados a grafos de estado (Fase 4) [32, 35].
docs/02-requisitos.md: Impõe SLAs rígidos de ingestão de webhooks (< 2 segundos) [50], tempo de resposta de IA (< 4 segundos) [50] e escalabilidade nominal de 10.000 requisições por minuto (166 req/s) [50].
docs/03-regras-de-negocio.md: Exige um pipeline local e de baixíssima latência para anonimização de dados (Pre-flight Sanitization) [63] e um job de expurgo físico programado aos 30 dias [65].
docs/arquitetura/01-visao-geral.md: Apresenta o desenho macro hexagonal da arquitetura, exigindo desacoplamento por portas e adaptadores, mensageria e persistência ACID [98, 99].
2.2. Documentos Futuros que Dependem deste Arquivo
docs/arquitetura/03-arquitetura-backend.md e 04-arquitetura-frontend.md: Detalharão as estruturas de pastas, frameworks de roteamento, middlewares e controllers com base nas linguagens escolhidas aqui.
docs/arquitetura/05-arquitetura-banco.md: Modelará as entidades relacionais e o índice vetorial no banco escolhido.
docs/arquitetura/07-arquitetura-filas.md: Detalhará a configuração do Message Broker e o ciclo de vida dos jobs de segundo plano.
docs/arquitetura/08-arquitetura-ia.md: Especificará os SDKs e pipelines de inferência de LLM.
docs/devops/: Modelará o provisionamento de containers, IaC (Terraform) e pipelines de CI/CD.
2.3. Relação com Registros de Decisões Arquiteturais (ADRs)
As escolhas detalhadas neste documento formalizam as bases técnicas para a criação dos seguintes ADRs:

ADR-001 (NestJS & Clean Architecture): Justificativa da adoção do TypeScript/NestJS como fundação estrutural do backend.
ADR-002 (Redis + BullMQ como Message Broker): Decisão de utilizar a infraestrutura Redis existente para mensageria assíncrona, cortando o custo de clusters adicionais.
ADR-003 (PostgreSQL + pgvector): Decisão de unificar o banco de dados relacional e a pesquisa vetorial em uma única instância robusta do Postgres, viabilizando RAG de baixo custo.
ADR-004 (Mascaramento Local e Job de Purge): Detalhamento do motor de sanitização de texto em memória e sua biblioteca base.
3. Camada Backend (Backend Core Engine)
3.1. Linguagem de Programação Principal: TypeScript (Node.js)
Optou-se por utilizar TypeScript rodando sobre o runtime Node.js (v20+ LTS) para a construção do Backend Core Engine.

Comparação de Alternativas:
Critério	TypeScript (Node.js)	Python 3.12	Go (Golang)
I/O Assíncrono	Excelente (Event Loop)	Bom (asyncio)	Excelente (Goroutines)
Productivity (DX)	Altíssima (Tipagem/Ecosistema)	Altíssima (Dinâmica)	Média (Sintaxe verbosa)
Ecossistema IA	Bom (Vercel AI, LangChain.js)	Excelente (Nativo/De facto)	Baixo (SDKs manuais)
Consumo de Memória	Médio (200-500MB por container)	Alto (dependências pesadas)	Baixíssimo (< 50MB)
Concorrência p/ WebSockets	Excelente (Nativo/WebSockets)	Médio (WSGI/ASGI overhead)	Excelente (Nativo/Leve)
Velocidade de Execução	Rápida (JIT compiler V8)	Lenta (Interpretada)	Ultra-Rápida (Compilada)
Justificativa Técnica da Escolha:
Concorrência e Ingestão Assíncrona: A recepção de webhooks do WhatsApp Cloud API exige um servidor altamente eficiente em I/O não-bloqueante para responder o HTTP 200 OK em menos de 2 segundos [50, 73, 100]. O Event Loop do Node.js é projetado especificamente para essa carga de alta concorrência de I/O, consumindo menos recursos computacionais por requisição do que o Python sob servidores ASGI [73].
Unificação da Linguagem (Full Stack TypeScript): Compartilhar TypeScript entre o Frontend (React) e o Backend reduz a barreira cognitiva para os desenvolvedores e acelera exponencialmente o desenvolvimento assistido por IA (Gemini/ChatGPT), uma vez que as regras de modelagem de dados, tipos de DTOs e validações podem ser reaproveitadas por completo [23, 87].
Maturação do Ecossistema de IA em JS/TS: Com o lançamento do Vercel AI SDK, a manipulação de fluxos de LLM estruturados, chamadas de ferramentas (Function Calling) e streaming tornaram-se tão eficientes e robustos em TypeScript quanto em Python, eliminando a dependência obrigatória de Python para orquestração analítica de IA [32].
3.2. Framework de Desenvolvimento: NestJS (com Fastify)
Para garantir que a Clean Architecture / Hexagonal seja rigorosamente mantida pelo time de engenharia e agentes de IA [92, 98], adotamos o NestJS configurado para rodar sobre o Fastify (substituindo o Express padrão).

Justificativa Técnica da Escolha:
Estrutura de Classes e Injeção de Dependência: O NestJS fornece um sistema robusto de injeção de dependência nativo (Dependency Injection) baseado em módulos. Isso viabiliza o desacoplamento arquitetural (Ports and Adapters), facilitando o isolamento total do domínio contra as portas de entrada (HTTP Fastify, WebSockets, BullMQ Consumers) e as portas de saída (Prisma ORM, Redis client) [99, 102].
Fastify para Alta Performance: O Fastify é até 2.5x mais rápido do que o Express clássico em taxa de transferência (throughput) e possui um consumo de memória significativamente menor. Essa combinação permite ao NestJS atingir confortavelmente a meta de 10.000 requisições por minuto (RNF-04) sob instâncias enxutas do AWS ECS Fargate, reduzindo os custos de infraestrutura em escala [50, 95].
3.3. ORM (Object-Relational Mapping): Prisma ORM
Utilizaremos o Prisma ORM como nossa camada de abstração de dados com o PostgreSQL.

Justificativa Técnica da Escolha:
Type-Safe Client Autogerado: O Prisma gera um cliente TypeScript estritamente tipado baseado no arquivo de schema global (schema.prisma). Isso elimina erros de consulta em tempo de compilação, acelera o desenvolvimento de novas migrações e garante integridade referencial nativa [97].
Gerenciamento de Migrações Simples: O prisma migrate oferece uma trilha de auditoria determinística do banco de dados, permitindo a sincronização fluida entre ambientes de desenvolvimento, staging e produção.
4. Camada Frontend (Single Page Application)
4.1. Framework Base: React (com Vite)
Conforme as diretrizes de entrega do produto, o painel do VendoraAI será desenvolvido como uma Single Page Application (SPA) Web Responsiva, servida inteiramente por arquivos estáticos via CDN (AWS CloudFront / Vercel), sem necessidade de Server-Side Rendering (SSR) [23]. O framework escolhido é o React (v18+) utilizando o Vite como ferramenta de build.

Justificativa Técnica da Escolha:
Arquitetura Estática (Zero CPU Overhead no Servidor): Hospedar o painel em uma CDN estática elimina por completo os custos com servidores de aplicação frontend (como instâncias Node.js rodando Next.js SSR) [23, 28]. Toda a computação de renderização de telas ocorre no navegador do cliente final [23].
Velocidade do Vite: O Vite utiliza ES Modules nativos em desenvolvimento e realiza bundling de produção de alta performance através do Esbuild e Rollup. A experiência do desenvolvedor (DX) é incomparável em relação ao antigo Webpack, com inicialização instantânea do servidor local e HMR (Hot Module Replacement) sub-segundo.
4.2. Estilização e Design System: Tailwind CSS + shadcn/ui
A interface do usuário será pautada no princípio da Simplicidade Radical [10, 25].

Tailwind CSS: Framework utilitário CSS que acelera a estilização responsiva direto no arquivo do componente, sem a sobrecarga de arquivos CSS externos ou overhead em tempo de execução das antigas bibliotecas CSS-in-JS (como styled-components).
shadcn/ui (Radix UI): Coleção de componentes de interface de usuário (UI) acessíveis, não-estilizados e copiáveis. Os componentes (modais, tabelas, popovers) são baseados em Radix UI (Primitives de acessibilidade WAI-ARIA) e são injetados diretamente na base de código do projeto. Isso garante controle absoluto do código CSS de cada elemento, eliminando o inchaço de dependências (bloatware) típico de bibliotecas fechadas como Material UI ou Ant Design.
4.3. Gerenciamento de Estado e Sincronização: React Query & Zustand
Para evitar a complexidade desnecessária e o overhead de performance do Redux, adotamos uma estratégia híbrida focada em simplicidade e performance:

TanStack React Query (v5): Responsável por todo o estado assíncrono (comunicação com a API). Ele gerencia de forma nativa o cache de dados, deduplicação de requisições, retentativas automáticas em caso de erro na rede e sincronização passiva de dados em segundo plano.
Zustand: Biblioteca de gerenciamento de estado global de apenas 1KB, baseada em hooks simples. Utilizada apenas para o estado de UI local (ex: estado de abertura de modais de configurações, preferências de tema do usuário, tenant ativo no seletor), removendo por completo a complexidade de contextos do React ou reducers pesados.
5. Camada de Persistência e Banco de Dados (Database Layer)
5.1. Banco de Dados Relacional Principal: PostgreSQL (v16+)
O repositório transacional e analítico estruturado do VendoraAI será o PostgreSQL.

Justificativa Técnica da Escolha:
Robustez ACID e Integridade: Garantia absoluta de consistência transacional para dados financeiros, faturamento de assinaturas, controle de permissões (RBAC) e logs de SLA útil comercial [55, 61, 76].
Estratégia de Multi-Tenancy Segura: O isolamento de dados dos Tenants (empresas parceiras) será implementado via Banco de Dados Compartilhado com Identificador de Tenant (tenant_id) nas tabelas [68]. Para garantir segurança máxima em repouso e em tempo de execução, utilizaremos políticas nativas de Row-Level Security (RLS) do PostgreSQL na camada de infraestrutura do banco de dados, impedindo que vazamentos acidentais de escopo de consultas no backend exponham dados de um Tenant a outro.
5.2. Banco de Dados Vetorial (Pesquisa Semântica RAG): Extensão pgvector
Diferente de arquiteturas que adotam bancos vetoriais dedicados e complexos (como Pinecone, Milvus ou ChromaDB), o VendoraAI utilizará a extensão nativa pgvector integrada diretamente ao banco de dados PostgreSQL existente [99].

Justificativa Técnica da Escolha:
Redução de Custos Operacionais (Cost-Efficiency): Manter uma instância separada de um banco de dados vetorial em nuvem (como Pinecone) adiciona uma despesa fixa mínima de $50 a $100/mês por ambiente. Ao rodar pgvector, o VendoraAI reutiliza a capacidade de CPU/Memória da instância do PostgreSQL existente, resultando em custo incremental de infraestrutura vetorial praticamente zero [28, 95].
Integridade Transacional e Consistência: Toda a busca semântica para RAG (Fase 3) ocorre dentro do mesmo escopo transacional [34]. Não há necessidade de criar pipelines complexos de sincronização assíncrona entre o banco relacional e o banco vetorial, eliminando o risco de "vetores órfãos" ou atrasos de consistência eventual.
Expurgo Físico em 30 dias Simplificado (LGPD): A RN-PRIV-02 exige que todo texto de conversa bruta seja apagado permanentemente após 30 dias [65]. Com pgvector, as mensagens e seus respectivos vetores de embeddings residem na mesma linha (ou tabela relacionada) do PostgreSQL [99]. O job diário de purge é executado via um comando simples SQL:
UPDATE messages
SET text_content = '[EXPURGADO]', embedding = NULL
WHERE created_at < NOW() - INTERVAL '30 days';
Isso exclui fisicamente o vetor e o texto bruto ao mesmo tempo, simplificando radicalmente o cumprimento das regras de privacidade [65, 105].
5.3. Banco de Dados de Cache e Sessão: Redis (v7+)
O Redis atuará como nossa camada de persistência em memória de altíssima velocidade.

Justificativa Técnica da Escolha:
Sessões e Rate Limiting: Armazenamento de tokens JWT de sessão de usuários ativos e controle estrito de limites de requisições de APIs (Rate Limiting) para blindagem do API Gateway [74, 75].
Processamento de Desvios de SLA em Memória: Para suportar alertas em tempo real de leads que estão esfriando (há mais de 2 horas sem interação útil do vendedor) [57], o backend escreverá hashes simplificados de conversas abertas e seus timestamps de expiração no Redis. O monitoramento desses desvios ocorre por meio de operações de chave-valor de sub-milissegundo, desonerando o PostgreSQL transacional de queries periódicas de varredura pesadas [33, 99].
6. Camada de Mensageria e Processamento de Filas
6.1. Message Broker: BullMQ (baseado em Redis)
Para a orquestração assíncrona das tarefas do sistema — recebimento de Webhooks, processamento e classificação por IA, envio de eventos em tempo real, anonimização local e jobs recorrentes de limpeza — adotamos o BullMQ rodando sobre a infraestrutura Redis existente [99].

Comparação de Alternativas:
Critério	BullMQ (sobre Redis)	RabbitMQ (Cluster)	AWS SQS (Serverless)
Arquitetura de Infraestrutura	Reutiliza o Redis existente	Exige cluster dedicado (VMs)	Totalmente gerenciado (AWS)
Custo Mensal Inicial	$0 (Custo marginal no Redis)	$40 - $80 (Mínimo p/ Rabbit)	Centavos por uso
Latência de Mensagem	Sub-milissegundo	Baixíssima	Baixa
Recursos de Fila	Prioridade, atrasos, retries	Roteamento avançado (AMQP)	Simples, pouca flexibilidade
Developer Experience (DX)	Excelente (TypeScript nativo)	Média (Bibliotecas legadas)	Boa (SDK AWS)
Tolerância a Carga	Alta (suporta > 50k jobs/s)	Altíssima	Praticamente ilimitada
Justificativa Técnica da Escolha:
Minimização do Overhead de Infraestrutura: Um cluster RabbitMQ gerenciado na nuvem gera um custo mínimo substancial que encarece a operação de um SaaS em validação inicial [28, 95]. Como o Redis já é obrigatório para cache e WebSockets [74], o BullMQ utiliza essa mesma memória de forma inteligente, dispensando o provisionamento de um novo broker complexo de gerenciar [75, 99].
Recursos Avançados de Jobs no Ecossistema Node.js: O BullMQ possui suporte robusto e nativo em TypeScript para recursos fundamentais de nossa arquitetura, como:
Delayed Jobs: Agendamento de checagem de ociosidade de SLA para 2 horas no futuro, com cancelamento automático caso o vendedor responda o lead antes do prazo.
Parent-Child Jobs (Pipelines): Criação de fluxos sequenciais estruturados (Ex: Recebe Webhook $\rightarrow$ Sanitiza Local $\rightarrow$ Persiste Banco $\rightarrow$ Executa IA $\rightarrow$ Envia WebSocket) [100].
Automatic Retries com Backoff: Políticas automáticas de retentativa exponencial em caso de falha de conexão com APIs externas (WhatsApp Meta ou LLMs de parceiros) [50, 95].
7. Camada de Inteligência Artificial e LLMs
7.1. Provedores de Modelos de Linguagem (LLMs)
Para atingir a meta técnica de limitar o custo operacional de IA a no máximo 15% do valor do plano pago pelo cliente (RNF-08) [50], o VendoraAI implementa uma estratégia de Model Routing (Roteamento Dinâmico de Modelos) utilizando APIs serverless sob demanda [28, 95]:

Modelo de Alta Performance & Custo-Eficiente (Padrão): Google Gemini 1.5 Flash
Uso: Ingestão diária de mensagens, classificação semântica instantânea de motivos de perda (Fase 1) [32, 59], análise rápida de sentimento, extração de entidades cadastrais (Fase 3) [34, 47] e triagem inicial de conversas (Fase 4) [35, 48].
Justificativa: Apresenta o menor custo por milhão de tokens do mercado na categoria de modelos rápidos, aliado a uma janela de contexto gigante de até 1 milhão de tokens (ideal para carregar históricos extensos de conversas sem necessidade de truncamentos agressivos) [36]. Possui excelente suporte nativo para saída de dados estruturados em JSON [32].
Modelo de Raciocínio Complexo: Google Gemini 1.5 Pro
Uso: Geração de rascunhos de propostas comerciais de alta fidelidade (RAG - Fase 3) [34], criação de relatórios narrativos gerenciais complexos e análise profunda de auditoria de performance dos vendedores [43].
Justificativa: Ideal para tarefas que exigem alto poder cognitivo, obediência estrita a regras de contexto (catálogos de produtos e FAQ da empresa) e síntese de relatórios detalhados com raciocínio analítico sênior [18].
Modelo de Contingência (Fallback / Alta Disponibilidade): OpenAI GPT-4o mini
Uso: Acionado automaticamente pelo Backend Core sempre que o gateway identificar indisponibilidade temporária ou rate-limiting crítico nas APIs da Google Cloud [50, 95].
Justificativa: Garante que o requisito de alta disponibilidade e tolerância a falhas do sistema (RNF-07) seja cumprido com custos operacionais equivalentes ao Gemini 1.5 Flash [50].
7.2. Bibliotecas de Orquestração de IA
Vercel AI SDK (TypeScript): SDK unificado para integração com provedores de IA. Ele fornece primitivas poderosas como generateText, streamText (streaming de respostas para rascunhos em tempo real no frontend) e generateObject (garante que a extração semântica retorne exatamente a estrutura JSON validada pelo nosso schema de dados, eliminando erros de parser) [34].
LangGraph.js (Fase 4): Utilizado na construção dos Agentes Comerciais Autônomos de triagem e agendamento [35]. Diferente de orquestradores sequenciais simples, o LangGraph permite modelar agentes como máquinas de estado cíclicas e grafos direcionados, oferecendo controle determinístico e previsibilidade absoluta sobre o fluxo de diálogos autônomos [35].
8. Infraestrutura, DevOps e Observabilidade (DevOps Layer)
8.1. Containerização: Docker
Tanto o Backend Core (NestJS) quanto as ferramentas auxiliares serão distribuídos como Containers Docker leves.
Utilizaremos builds multi-stage para gerar imagens de produção mínimas (baseadas em Alpine Node), reduzindo a superfície de ataque e otimizando o tempo de deploy de novas versões.
8.2. Provedor de Cloud Principal: AWS (Amazon Web Services)
Toda a infraestrutura do VendoraAI será modelada via Terraform (Infraestrutura como Código - IaC) na nuvem da AWS, garantindo replicação instantânea de ambientes (Development, Staging e Production).

Topologia de Serviços AWS Escolhidos:
AWS App Runner (ou ECS Fargate): Hospedagem serverless dos containers do Backend Core. Elimina o gerenciamento de sistemas operacionais, escala horizontalmente de forma automática com base no volume de requisições e possui custo zerado quando não houver tráfego (ótimo para otimização inicial de despesas) [28, 95].
Amazon RDS (PostgreSQL Serverless v2): Banco de dados relacional gerenciado. Possui escalabilidade elástica automática de capacidade de computação (ACUs) em tempo real de acordo com a carga do sistema, além de backup automatizado diário e criptografia AES-256 nativa em repouso (RNF-01) [50].
Amazon ElastiCache (Redis): Gerenciamento nativo e escalável da camada de cache e filas (BullMQ) [74, 75].
AWS S3 (Simple Storage Service): Armazenamento seguro de backups criptografados, mídias recebidas e exportações de relatórios PDF.
AWS CloudFront: CDN de alta performance responsável por distribuir os arquivos estáticos do Frontend SPA (React) com latência ultra-baixa de ponta a ponta [23].
8.3. Observabilidade e Monitoramento Distribuído
Como o sistema processa webhooks assíncronos que dependem de terceiros e múltiplos passos internos, a rastreabilidade é obrigatória [95]:

OpenTelemetry: Padronização de logs, métricas e traces (rastreabilidade distribuída) instrumentada nativamente no NestJS. Permite rastrear exatamente o caminho e a latência de uma mensagem desde o momento em que o webhook bateu no gateway até a conclusão da análise pela LLM [99, 100].
Pino Logger (Structured JSON Logging): Biblioteca de logs em JSON de altíssima performance estruturada para o NestJS, garantindo que nenhum processamento de logs introduza lentidão no event loop do Fastify. Os logs são direcionados para o CloudWatch da AWS.
Sentry: Monitoramento em tempo real de exceções e erros não capturados no Backend e no Frontend, gerando alertas instantâneos de incidentes para o time de engenharia.
9. Resumo da Stack Tecnológica (Aprovada)
┌─────────────────────────────────────────────────────────────────────────┐
│                           FRONTEND (React SPA)                          │
│               Vite + TypeScript + Tailwind CSS + shadcn/ui              │
│                 State: React Query (Server) / Zustand (UI)              │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │ HTTPS / WSS (WebSockets)
                                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                          API GATEWAY (HTTPS/WSS)                        │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                      BACKEND CORE (NestJS + Fastify)                    │
│             Clean Hexagonal Architecture + Prisma + Winston/Pino        │
│    ┌────────────────────────┐               ┌──────────────────────┐    │
│    │ Ingestion (Fastify)    ├──────────────►│ Pre-flight Sanitizer │    │
│    └────────────────────────┘               └──────────┬───────────┘    │
└────────────────────────────────────────────────────────┼────────────────┘
                                                         │ Events / Jobs
                                                         ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                     MESSAGE BROKER & CACHE (Redis)                      │
│                  BullMQ / Cache / Rate Limit / WS Sessions              │
└────────────────────┬───────────────────────────────────┬────────────────┘
                     │                                   │
                     ▼ Jobs                              ▼ Cache / Temp SLA
┌────────────────────────────────────────┐  ┌─────────────────────────────┐
│       ANALYTICAL ENGINE (NestJS)       │  │        PERSISTENCE          │
│ Vercel AI SDK / LangGraph / Model Route│  │                             │
│   Gemini 1.5 Flash / GPT-4o mini       │  │  PostgreSQL (ACID/Multi)    │
│   Gemini 1.5 Pro (RAG/Reports)         │  │  pgvector (Semantic Search) │
└────────────────────────────────────────┘  └─────────────────────────────┘
10. Consequências, Impactos e Próximos Passos
10.1. ADRs Recomendados para Criação Imediata
docs/adr/ADR-001.md: Consolidação técnica do NestJS, Fastify e Clean Architecture [106].
docs/adr/ADR-002.md: Arquitetura de processamento de filas e pipelines assíncronos baseados em BullMQ + Redis [106].
docs/adr/ADR-003.md: Escolha do PostgreSQL unificado com pgvector em substituição a bancos vetoriais isolados na nuvem [106].
docs/adr/ADR-004.md: Detalhes de biblioteca e infraestrutura lógica para o sanitizador de dados local (Pre-flight Sanitization) [106].
10.2. Arquivos Futuros que Devem Ser Atualizados com as Decisões Deste Documento
docs/arquitetura/03-arquitetura-backend.md: Deve ser desenhado prevendo estritamente os padrões de módulos, providers e controllers do NestJS integrados ao Fastify.
docs/arquitetura/04-arquitetura-frontend.md: Detalhará a estruturação física de pastas do React com o Vite, os hooks customizados do React Query e a integração do Zustand para controle local.
docs/arquitetura/05-arquitetura-banco.md: Conterá as definições de modelagem em linguagem Prisma Schema (schema.prisma), índices de busca relacional do Postgres e configurações de tamanho de dimensão de embeddings do pgvector baseados nas saídas das LLMs escolhidas.
docs/arquitetura/08-arquitetura-ia.md: Detalhará a integração de RAG baseada no Vercel AI SDK e o fluxo de grafos no LangGraph.js para os agentes da Fase 4.