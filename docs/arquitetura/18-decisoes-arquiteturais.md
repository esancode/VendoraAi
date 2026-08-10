Registro de Decisões Arquiteturais (ADR Log)
Este documento atua como o repositório oficial de registros de decisões arquiteturais (ADRs - Architecture Decision Records) do VendoraAI. Ele consolida, formaliza e blinda todas as escolhas tecnológicas e estruturais críticas tomadas no projeto, justificando seus contextos técnicos, alternativas avaliadas, compromissos (trade-offs) e rastreabilidade com os requisitos de negócios e de engenharia.

Estrutura do Repositório de ADRs
Para manter a consistência e a facilidade de leitura por equipes humanas e agentes autônomos de IA, cada registro neste documento segue o formato padronizado da indústria:

### ADR-XXX: [Título Curto e Autoexplicativo]
* **Data:** AAAA-MM-DD
* **Status:** [Proposto | Aprovado | Rejeitado | Substituído]
* **Contexto:** [Qual o problema técnico ou de negócio que gerou a necessidade desta decisão?]
* **Alternativas Avaliadas:** [Quais outras soluções foram consideradas e por que foram descartadas?]
* **Decisão:** [Qual a solução escolhida e como ela será implementada?]
* **Consequências Positivas:** [Quais benefícios diretos e indiretos essa decisão traz?]
* **Consequências Negativas (Trade-offs):** [Quais são os pontos de atenção ou desvantagens introduzidas?]
* **Rastreabilidade:** [Quais requisitos (RFs/RNFs) ou Regras de Negócio (RNs) essa decisão atende?]
Índice de Decisões Arquiteturais (ADRs)
ID	Decisão Arquitetural	Status	Área de Impacto	Rastreabilidade Primária
ADR-001	Monólito Modular com Clean Architecture & NestJS	Aprovado	Estruturação de Código	RF-01 a RF-12, RNF-09
ADR-002	Redis + BullMQ para Mensageria e Filas Assíncronas	Aprovado	Comunicação Assíncrona	RNF-02, RNF-04, RNF-07
ADR-003	PostgreSQL 16 + pgvector como Banco de Dados Unificado	Aprovado	Armazenamento & RAG	RNF-01, RNF-08, RN-PRIV-02
ADR-004	Anonimização Local ("Pre-flight Sanitizer") no Backend	Aprovado	Privacidade & Segurança	RNF-01, RN-PRIV-01
ADR-005	Armazenamento de Objetos com Cloudflare R2	Aprovado	Armazenamento de Arquivos	RNF-08, RN-PRIV-02
ADR-006	Roteamento Dinâmico de Custos com Vercel AI SDK	Aprovado	Inteligência Artificial	RNF-03, RNF-08, RN-COB-02
ADR-007	Isolamento Multi-Tenant por PostgreSQL Row-Level Security	Aprovado	Segurança de Dados	RNF-01, RN-PRIV-01
ADR-008	Telemetria Unificada com OpenTelemetry, Pino e Prometheus	Aprovado	Observabilidade	RNF-02, RNF-03, RNF-11
ADR-001: Monólito Modular com Clean Architecture & NestJS
Data: 2026-08-07
Status: Aprovado
Contexto: O VendoraAI precisa conciliar uma alta velocidade de entrega inicial de funcionalidades de inteligência (Developer Velocity) para validação de mercado com uma estrutura de código altamente robusta, testável e desacoplada de frameworks. Se o sistema for construído de forma desorganizada, o acúmulo de débito técnico inviabilizará a manutenção. No entanto, dividir o sistema em dezenas de microsserviços na Fase 1 traria complexidade operacional prematura e custos altos de infraestrutura, incompatíveis com um modelo SaaS para PMEs brasileiras.
Alternativas Avaliadas:
Microsserviços Distribuídos: Descartados devido ao alto custo operacional (múltiplas instâncias no AWS ECS), complexidade de rede, latência adicional por chamadas RPC de rede e dificuldade de sincronização transacional entre contextos.
Monólito "Spaghetti" Tradicional: Descartado pela rápida degradação da qualidade do código, forte acoplamento com dependências (como Prisma ou NestJS), tornando a manutenção complexa e impedindo testes unitários eficazes das regras de negócio.
Decisões: Utilizar um padrão de Monólito Modular utilizando o framework NestJS sob as diretrizes de Clean Architecture (Arquitetura Limpa) e Domain-Driven Design (DDD) tático.
O código será dividido em módulos lógicos isolados por contextos delimitados (Bounded Contexts), como TenantModule, IngestionModule, LeadModule, IntelligenceModule e ComplianceModule.
Cada contexto delimitado manterá sua camada de Domínio (Entidades puras e regras de negócio essenciais) 100% isolada e protegida, comunicando-se com componentes externos (bancos de dados, gateways, APIs de IA) estritamente por meio de interfaces abstratas (Ports and Adapters).
O framework NestJS e o ORM Prisma serão tratados exclusivamente como detalhes de infraestrutura e implementações de adaptadores secundários de saída (Driving Adapters).
Consequências Positivas:
Alta Testabilidade: 100% de cobertura de testes unitários nas regras de negócio e cálculo de SLA útil, sem necessidade de levantar servidores, mocks de banco complexos ou dependências de rede.
Custo de Infraestrutura Mínimo: Todo o backend roda sob uma única instância enxuta de container no AWS ECS Fargate, reduzindo custos operacionais para menos de $15/mês em staging.
Facilidade de Decomposição: Se no futuro um módulo como o IngestionModule atingir um volume de tráfego que exija escalabilidade independente, ele poderá ser facilmente extraído e transformado em um microsserviço isolado, pois seus limites de domínio já estão fisicamente isolados em código.
Consequências Negativas (Trade-offs):
Curva de Aprendizado: Exige disciplina técnica rigorosa dos desenvolvedores para evitar vazamento de dependências e garantir que as camadas de Domínio permaneçam puras (sem importações do NestJS ou Prisma).
Overhead de Boilerplate: Criação de arquivos adicionais de mapeamento de dados (Mappers), interfaces de repositórios e injeção manual de dependências no NestJS.
Rastreabilidade:
Requisitos: RF-01 a RF-12 (Entregas modulares de valor), RNF-09 (Cobertura de Testes de 80%).
Documento de Origem: docs/arquitetura/03-arquitetura-backend.md
ADR-002: Redis + BullMQ para Mensageria e Filas Assíncronas
Data: 2026-08-07
Status: Aprovado
Contexto: O WhatsApp Cloud API envia atualizações de mensagens via webhooks síncronos de forma massiva. Sob picos de tráfego de milhares de lojas simultaneamente, processar síncronamente cada mensagem (executar sanitização local, gerar embeddings vetoriais, chamar APIs externas de IA e transcrever mídias) causaria gargalos na thread do NodeJS, picos de CPU, timeouts de rede e, consequentemente, perda de mensagens valiosas dos leads. O processamento pesado deve ocorrer de forma assíncrona, tolerante a falhas e isolada do servidor de recebimento de webhooks.
Alternativas Avaliadas:
RabbitMQ / Apache Kafka: Descartados para a fase inicial devido ao alto custo financeiro fixo (mínimo de $50 a $100/mês para instâncias gerenciadas em nuvem) e complexidade de infraestrutura para provisionar e manter clusters redundantes de alta disponibilidade.
AWS SQS (Simple Queue Service): Descartado pelo custo variável cumulativo de polling constante e, principalmente, pela ausência de suporte nativo a funcionalidades avançadas de filas como Fair Queueing (evitar o problema do vizinho barulhento de forma nativa) e limitação de concorrência por tipo de tarefa.
Decisões: Adotar o BullMQ como gerenciador de filas e mensageria assíncrona, rodando sobre a infraestrutura de memória do Redis.
A recepção de webhooks no backend é imediata (<50ms). Ela apenas valida a integridade do payload, grava o log rápido e delega a mensagem do WhatsApp para a fila whatsapp-ingestion no Redis.
O processamento é particionado em filas especializadas e isoladas: whatsapp-ingestion (captura e classificação inicial), ia-analysis (chamadas ao Vercel AI SDK) e media-downloader (manipulação assíncrona de arquivos e áudios).
Implementar regras de resiliência ativa no BullMQ: Exponential Backoff com Jitter (retentar 3 vezes iniciando em 1000ms) e desvio automático de jobs persistentes e irrecuperáveis para uma Dead Letter Queue (DLQ).
Consequências Positivas:
Isolamento de Erros: Quedas ou instabilidades na API do Google Gemini ou OpenAI não travam a recepção de novas mensagens dos clientes no WhatsApp. As tarefas apenas aguardam em fila para reprocessamento seguro.
Custo-Eficiência Extrema: Reutiliza o servidor Redis (que já é obrigatório para caching de sessões e rate limit), resultando em custo adicional fixo de infraestrutura igual a zero.
Alta Vazão: Suporta confortavelmente mais de 10.000 requisições por minuto com baixíssimo overhead de processamento na CPU.
Consequências Negativas (Trade-offs):
Dependência de Memória: O Redis armazena os metadados dos jobs em memória RAM. Se houver um acúmulo massivo de mensagens represadas por falhas persistentes na API de IA, o consumo de RAM do Redis pode estourar, exigindo políticas agressivas de expiração de logs de jobs completados.
Rastreabilidade:
Requisitos: RNF-02 (Ingestão < 2s), RNF-04 (Vazão de 10k RPM), RNF-07 (Tolerância a falhas).
Documento de Origem: docs/arquitetura/07-arquitetura-filas.md
ADR-003: PostgreSQL 16 + pgvector como Banco de Dados Unificado
Data: 2026-08-07
Status: Aprovado
Contexto: O VendoraAI necessita de um sistema de armazenamento que concilie a rigidez transacional e relacional tradicional (controle de Tenants, usuários, faturas, regras de planos e histórico de leads) com recursos modernos de busca semântica em linguagem natural (necessários para alimentar a base de conhecimento e FAQ via RAG - Retrieval-Augmented Generation na Fase 3). O uso de múltiplos bancos de dados em um ecossistema inicial gera sérios desafios de consistência transacional e eleva os custos operacionais.
Alternativas Avaliadas:
Bancos Vetoriais Dedicados (Pinecone, ChromaDB, Milvus): Descartados devido ao alto custo operacional fixo de infraestrutura (mínimo de $50 a $100/mês para ambientes de staging e produção) e complexidade no desenvolvimento de pipelines de sincronização assíncrona, com risco iminente de gerar inconsistências ("vetores órfãos" ou descompasso temporal de dados).
Bancos Não Relacionais (MongoDB / Elasticsearch): Descartados pela falta de garantias transacionais ACID nativas rigorosas para o controle financeiro multi-tenant de assinaturas e lentidão em cruzamentos de tabelas relacionais de leads e faturamento.
Decisões: Adotar o PostgreSQL 16 como mecanismo de persistência único e unificado do sistema, utilizando a extensão nativa pgvector para o armazenamento de embeddings e execução de busca semântica de RAG.
Configurar o tipo Unsupported("vector(768)") nas colunas do Prisma Schema, compatível com a dimensão nativa do modelo text-embedding-004 do Google Gemini.
Utilizar o índice vetorial HNSW (Hierarchical Navigable Small World) nas tabelas de embeddings devido ao seu excelente desempenho sob carga, menor consumo de CPU e busca semântica em menos de 10ms.
Integrar o expurgo de mensagens e mídias brutas da LGPD com o expurgo de dados vetoriais na mesma transação lógica ACID, deletando as linhas associadas em uma única query física.
Consequências Positivas:
Consistência ACID Absoluta: O RAG opera sobre dados transacionais consistentes no exato momento da gravação. Sem risco de latência de sincronização ou dados órfãos.
Custo FinOps Praticamente Zero: Reutiliza a instância existente do RDS/PostgreSQL transacional, eliminando despesas fixas com bancos de dados vetoriais de terceiros.
Conformidade LGPD Facilitada: A exclusão física de um lead ou mensagem no banco relacional limpa automaticamente seus embeddings vetoriais associados via triggers de chaves estrangeiras (ON DELETE CASCADE).
Consequências Negativas (Trade-offs):
Pressão de RAM: A busca em índices HNSW exige que o índice de busca vetorial esteja carregado na memória RAM do banco para manter latências baixas. Isso exigirá um dimensionamento preventivo da memória do RDS à medida que o número de lojas e tamanho de catálogos escalar.
Rastreabilidade:
Requisitos: RNF-01 (Privacidade e Segurança), RNF-08 (Custo de IA), RN-PRIV-02 (Expurgo Físico).
Documento de Origem: docs/arquitetura/05-arquitetura-banco.md
ADR-004: Anonimização Local ("Pre-flight Sanitizer") no Backend
Data: 2026-08-07
Status: Aprovado
Contexto: O VendoraAI processa conversas de leads contendo dados pessoais sensíveis (nomes, telefones, CPFs, CNPJs, dados de pagamento) e as envia para APIs externas de Inteligência Artificial de terceiros (Google Gemini, OpenAI GPT) para extração de intenções e rascunhos de mensagens. Enviar esses dados identificáveis (Personally Identifiable Information - PII) brutos violaria frontalmente a Lei Geral de Proteção de Dados (LGPD - Lei nº 13.709), expondo o SaaS e seus clientes a pesadas multas judiciais e quebras de confiança.
Alternativas Avaliadas:
Envio de Dados Brutos (Zero-Sanitization): Descartado por representar risco jurídico extremo de não conformidade com a LGPD e violar o pilar corporativo de segurança e privacidade.
Hospedar LLMs Locais (Llama 3 / Mistral no AWS ECS): Descartado devido aos altíssimos custos de computação (servidores com placas de vídeo GPU como AWS g5.xlarge custando no mínimo $500 a $1000/mês), complexidade de infraestrutura para PMEs e latências de resposta severamente maiores.
Decisões: Desenvolver um motor local de sanitização de dados no backend, chamado Pre-flight Sanitizer, operando de forma transparente na camada de aplicação do NestJS antes de qualquer tráfego externo para APIs de IA.
Utilizar regex customizado de alta performance compilado em tempo de inicialização para identificar e mascarar CPFs, CNPJs, números de cartões de crédito, e-mails e telefones secundários no texto da conversa.
Implementar um sistema de tokens temporários no Redis (TTL de 15 minutos): antes do envio à API de IA, o dado sensível é mapeado para um token neutro (ex: {{CPF_1}}) e o mapa "De-Para" é guardado no Redis de forma isolada por tenant_id e lead_id.
No retorno da resposta estruturada da IA, o backend NestJS intercepta o payload e executa a operação reversa de Desanonimização de forma totalmente transparente e local, entregando a resposta legível para o rascunho de tela do vendedor humano.
Consequências Positivas:
Conformidade Absoluta (LGPD): Nenhum dado pessoal identificável (PII) sensível de leads é transmitido ou armazenado em servidores terceiros de inteligência artificial na nuvem.
Segurança jurídica: A startup e os lojistas parceiros possuem conformidade técnica auditável contra processos legais e investigações da ANPD.
Viabilidade Financeira: Permite continuar utilizando modelos proprietários de baixíssimo custo por chamada (Gemini 1.5 Flash), dispensando despesas com GPUs em nuvem para rodar LLMs locais.
Consequências Negativas (Trade-offs):
Latência Incremental: O processo de busca, substituição e armazenamento de tokens em Redis adiciona um pequeno overhead de latência (estimado em menos de 15 milissegundos por mensagem), o que é irrelevante frente ao ganho de segurança.
Rastreabilidade:
Requisitos: RNF-01 (Segurança e Privacidade), RN-PRIV-01 (Anonimização Local Obrigatoria).
Documento de Origem: docs/arquitetura/08-arquitetura-ia.md, docs/arquitetura/14-arquitetura-seguranca.md
ADR-005: Armazenamento de Objetos com Cloudflare R2
Data: 2026-08-07
Status: Aprovado
Contexto: O VendoraAI armazena arquivos de mídias pesados e contínuos recebidos via WhatsApp (imagens de comprovantes, áudios de conversas para transcrição, documentos em PDF de orçamentos). Esses arquivos precisam de isolamento multi-tenant rígido e alta velocidade de leitura. O uso de soluções tradicionais de armazenamento em nuvem pode encarecer drasticamente a operação por causa das taxas ocultas de transferência de rede de saída (egress fees) cobradas por gigabyte baixado.
Alternativas Avaliadas:
AWS S3 (Standard Storage): Descartado devido ao alto custo financeiro cumulativo gerado pelas taxas de egresso de rede de saída (em média $0.09 por GB transferido), o que inviabilizaria a margem de lucro de um plano SaaS inicial para PMEs sob tráfego contínuo de áudio e imagem.
Gravar mídias no PostgreSQL (tipo BYTEA / BLOB): Descartado por degradar rapidamente a performance de leitura/escrita do banco relacional, inflar desmesuradamente o tamanho das instâncias e inviabilizar rotinas rápidas de backup e Point-in-Time Recovery.
Decisões: Adotar o Cloudflare R2 como provedor de armazenamento de objetos em nuvem, operando de forma integrada à API S3.
O bucket do Cloudflare R2 será mantido como 100% privado. Nenhuma mídia será exposta para acesso público direto na internet.
A exibição de mídias e áudios na SPA do frontend para o vendedor humano ocorrerá por meio da geração dinâmica de URLs Assinadas Temporárias (Presigned URLs) pelo backend NestJS, configuradas com validade rígida e estrita de 15 minutos.
Organizar o diretório lógico do bucket utilizando prefixos multi-tenant estruturados: tenants/{tenant_id}/leads/{lead_id}/medias/{file_name} para garantir o isolamento físico de diretórios e facilitar jobs rápidos de expurgo.
Consequências Positivas:
Taxa Zero de Egresso (Zero Egress Fees): Reduz em até 90% os custos operacionais de tráfego de rede e armazenamento comparado ao AWS S3 tradicional, blindando o plano financeiro do SaaS contra estouros de tráfego.
Compatibilidade Total: Por expor a API padrão S3, o código do backend utiliza SDKs padrão da AWS, permitindo a migração transparente para qualquer provedor sem alteração de lógica de código.
Consequências Negativas (Trade-offs):
Overhead de Geração de URLs: Cada requisição de visualização na SPA do frontend exige que o backend assine criptograficamente a URL temporária de visualização, adicionando pequenas queries rápidas de metadados no backend.
Rastreabilidade:
Requisitos: RNF-08 (Eficiência Financeira), RN-PRIV-02 (Expurgo Físico).
Documento de Origem: docs/arquitetura/12-arquitetura-storage.md
ADR-006: Roteamento Dinâmico de Custos com Vercel AI SDK
Data: 2026-08-07
Status: Aprovado
Contexto: O VendoraAI possui metas rígidas de sustentabilidade financeira (RNF-08), limitando os gastos globais de consumo de APIs de IA a no máximo 15% do valor da assinatura paga pelo respectivo plano do Tenant (SLA de Custos). Para atingir essa eficiência operacional sob tráfego contínuo de conversas longas de varejo, o sistema não pode depender exclusivamente de LLMs caras de última geração (como GPT-4o bruto) nem ficar preso a um único fornecedor, o que criaria um ponto único de falha (vendor lock-in) de infraestrutura.
Alternativas Avaliadas:
Acoplamento Direto aos SDKs Proprietários da OpenAI ou Google: Descartado pelo forte acoplamento do código-fonte com a biblioteca específica do fornecedor, o que exigiria refatorações complexas de código sob mudanças de APIs e impediria o chaveamento ágil e em tempo real de modelos de fallback.
Utilizar Apenas LLM de Topo (GPT-4o / Claude 3.5 Sonnet): Descartado devido aos altos custos por milhão de tokens, inviabilizando a margem de lucro operacional estipulada em 15% nos planos Starter de baixo custo para PMEs.
Decisões: Adotar o Vercel AI SDK Core como orquestrador e abstração multimodelo de IA de baixo acoplamento no backend NestJS, implementando uma estratégia de Model Routing (Roteamento Dinâmico de Custos).
O modelo primário padrão para extração semântica, classificação de perda e sugestão de rascunhos rápidos será o Google Gemini 1.5 Flash, selecionado pela excelente velocidade, suporte a saídas estruturadas JSON via Zod, suporte nativo a cache de prompt e baixíssimo custo por milhão de tokens.
Implementar um mecanismo de fallback automático: em caso de erros de taxa limite (429), timeouts ou indisponibilidade da API do Google, o backend chaveia de forma transparente a chamada de execução para o OpenAI GPT-4o-mini, registrando a alteração na auditoria.
Desenvolver o BillingService no backend NestJS para monitorar em tempo real a volumetria de tokens gastos de cada Tenant, bloqueando chamadas ou acionando avisos preventivos a 80% do consumo contratado.
Consequências Positivas:
Blindagem de Margem de Lucro (FinOps): Redução drástica do custo operacional de tokens de IA por conversa, garantindo que a margem do SaaS permaneça saudável e dentro do teto estipulado de 15%.
Resiliência e SLA de Disponibilidade: Elimina o risco de paralisação do rascunho de vendas do lojista diante de eventuais quedas globais do provedor de IA principal.
Flexibilidade Operacional: Facilidade para atualizar o modelo de IA do sistema alterando apenas uma variável de ambiente, sem tocar na lógica core da aplicação.
Consequências Negativas (Trade-offs):
Consistência de Saída: Pequenas diferenças na estruturação e estilo gramatical das respostas podem surgir sob o chaveamento de modelos, exigindo prompts altamente estruturados e robustos com validação rígida via schemas do Zod.
Rastreabilidade:
Requisitos: RNF-03 (Tempo de IA < 4s), RNF-08 (Eficiência de IA < 15%), RN-COB-02 (Bloqueio Automático por Estouro).
Documento de Origem: docs/arquitetura/08-arquitetura-ia.md, docs/arquitetura/17-arquitetura-custos.md
ADR-007: Isolamento Multi-Tenant por PostgreSQL Row-Level Security
Data: 2026-08-07
Status: Aprovado
Contexto: O VendoraAI opera como uma plataforma SaaS multilocatária (multi-tenant), onde múltiplos clientes (empresas parceiras) compartilham a mesma infraestrutura de banco de dados por motivos de otimização de custos e simplicidade operacional. Em sistemas compartilhados tradicionais, uma pequena falha humana na escrita de uma consulta SQL (WHERE tenant_id = X esquecido) no backend pode vazar dados confidenciais comerciais ou leads de um lojista para outro. Este risco de vazamento de dados (IDOR / Broken Access Control) é inaceitável e violaria severamente a privacidade das empresas e a LGPD.
Alternativas Avaliadas:
Banco de Dados Separado por Tenant (Pool de Instâncias): Descartado devido ao alto custo fixo de infraestrutura (manter dezenas ou centenas de instâncias RDS menores custaria milhares de dólares/mês para a startup) e complexidade severa no gerenciamento e sincronização automática de migrações estruturais de schemas em produção.
Isolamento Puramente na Camada de Aplicação (Queries Manuais): Descartado por depender exclusivamente de disciplina humana e revisões de código constantes, mantendo alto o risco iminente de esquecer cláusulas de tenant em queries complexas.
Decisões: Adotar políticas nativas de Row-Level Security (RLS - Segurança a Nível de Linha) integradas diretamente na infraestrutura do banco de dados PostgreSQL 16.
Habilitar o RLS de forma obrigatória nas tabelas transacionais que contêm o campo tenant_id (como Lead, Conversation, Message, User).
Implementar a validação lógica usando uma variável de sessão personalizada e de escopo do Postgres: app.current_tenant_id. Cada query é avaliada pelo banco com a regra: USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid).
Configurar o Prisma ORM no backend NestJS para injetar automaticamente a variável de sessão app.current_tenant_id por meio de Transações Interativas e middlewares de banco que capturam a identificação do locatário autenticado a partir do token JWT do usuário em tempo de requisição.
Consequências Positivas:
Garantia Matemática de Isolamento: Mesmo se um desenvolvedor do time escrever uma query genérica prisma.lead.findMany() esquecendo o filtro de tenant no backend, o PostgreSQL interceptará a query em nível de sistema operacional e retornará estritamente os leads pertencentes àquele Tenant ativo, blindando vazamentos acidentais.
Defesa em Profundidade: Cria uma barreira física e automática de segurança blindando o banco de dados mesmo diante de eventuais falhas lógicas de autenticação do backend.
Consequências Negativas (Trade-offs):
Complexidade de Implementação com ORMs: ORMs tradicionais de NodeJS (como o Prisma) operam sob conexões compartilhadas e persistentes. Exige a criação de transações curtas adicionais (interactive transactions) para setar e limpar a variável de sessão a cada chamada física de query, adicionando pequeno overhead.
Rastreabilidade:
Requisitos: RNF-01 (Privacidade e Segurança), RN-PRIV-01 (Isolamento Multilocatário).
Documento de Origem: docs/arquitetura/05-arquitetura-banco.md, docs/arquitetura/11-arquitetura-autorizacao.md
ADR-008: Telemetria Unificada com OpenTelemetry, Pino e Prometheus
Data: 2026-08-07
Status: Aprovado
Contexto: O processamento do VendoraAI envolve fluxos assíncronos complexos, interações contínuas com filas do Redis, e integrações externas com APIs de IA de terceiros e WhatsApp Cloud API. Diante de eventuais lentidões reclamadas pelos lojistas (como rascunhos demorando para aparecer em tela), identificar onde reside o gargalo (se na rede do WhatsApp, na fila do Redis, na latência de geração de embeddings do pgvector ou na latência de inferência da API de IA) sem instrumentação estruturada e distribuída torna-se um trabalho de adivinhação exaustivo. No entanto, soluções APM proprietárias de mercado podem encarecer drasticamente a operação e violar as premissas de privacidade da LGPD.
Alternativas Avaliadas:
Logging Tradicional com console.log / Winston: Descartado pela lentidão de escrita e formatação no NodeJS, ausência de padronização estruturada para indexação centralizada e impossibilidade de realizar rastreamento distribuído entre webhooks e IA.
Agentes de Telemetria Proprietários (Datadog / Dynatrace): Descartados pelo altíssimo custo financeiro fixo e variável de licenciamento de APM e, principalmente, pelo acoplamento severo de código-fonte a bibliotecas fechadas e proprietárias, o que gera risco de vazamento de credenciais e dependência tecnológica.
Decisões: Adotar um ecossistema de observabilidade e telemetria unificado, open-source e leve baseado em Pino, Prometheus e especificação OpenTelemetry (OTel).
Utilizar a biblioteca Pino para geração de logs estruturados em formato JSON de baixíssimo overhead, com lógicas integradas de Redaction local que ocultam informações pessoais sensíveis (PII) de forma preventiva, impedindo que dados do cliente final caiam nos logs.
Implementar a instrumentação baseada no OpenTelemetry API, mapeando a correlação de ponta a ponta de spans utilizando cabeçalhos traceparent unificados desde o webhook do WhatsApp até a fila do BullMQ e chamadas finais de rascunhos.
Expor métricas nativas do NestJS, filas e banco via endpoint /metrics utilizando o Prometheus, gerando dashboards centralizados e alertas automáticos com base no SLA útil e tempos limites do sistema.
Consequências Positivas:
Baixíssimo Overhead de Performance: O Pino é até 5x mais rápido do que o Winston tradicional, liberando ciclos preciosos de CPU da thread principal do NodeJS para o processamento de regras transacionais.
Independência de Fornecedores (No Vendor Lock-in): Como o código é instrumentado utilizando o protocolo padrão OpenTelemetry, o VendoraAI pode migrar ou distribuir os dados de telemetria de forma instantânea para qualquer painel ou APM (Grafana Cloud, Jaeger, Datadog) sem precisar alterar uma única linha de código do sistema.
Diagnóstico Rápido: Identificação exata de gargalos de rede ou travamentos em APIs externas de IA em segundos por meio de traces distribuídos correlacionados.
Consequências Negativas (Trade-offs):
Curva de Configuração Inicial: Exige que o time de engenharia configure manualmente a propagação de contextos de traces (trace_id) através das barreiras físicas de comunicação assíncrona das filas do BullMQ no Redis.
Rastreabilidade:
Requisitos: RNF-02 (SLA Ingestão < 2s), RNF-03 (SLA Tempo de IA < 4s), RNF-11 (Métricas de SLA de Clientes).
Documento de Origem: docs/arquitetura/13-arquitetura-observabilidade.md