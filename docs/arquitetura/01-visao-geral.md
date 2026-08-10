Visão Geral da Arquitetura (docs/arquitetura/01-visao-geral.md)
Metadado	Detalhe
Versão	1.0
Status	Em planejamento
Escopo	Desenho Macro da Arquitetura e Fluxo de Dados
Autor	Arquiteto-Chefe
1. Introdução e Diretrizes Estratégicas
A arquitetura de software do VendoraAI é desenhada para converter a complexidade do processamento de linguagem natural e da orquestração de IA em uma solução pragmática, estável e financeiramente sustentável para Pequenas e Médias Empresas (PMEs).

O foco central da engenharia é traduzir o princípio de Simplicidade Radical em uma topologia técnica de baixo custo operacional (Cost-Efficiency), altíssima segurança/privacidade e escalabilidade elástica, garantindo que o sistema suporte o crescimento do negócio sem degradação de performance.

1.1. Pilares Tecnológicos Base
Inteligência em Primeiro Lugar (Decoupled IA Pipeline): A camada transacional (recebimento de mensagens) e a camada inteligente (LLM, RAG, classificação) são completamente isoladas por meio de mensageria assíncrona. Isso evita gargalos e impede que quedas ou lentidão nas APIs de IA externas (como OpenAI ou Anthropic) afetem a recepção de mensagens do WhatsApp.
Eficiência de Custo (Token-Saving & Serverless-First): Utilização de técnicas agressivas de compressão de contexto, cache de prompt, modelos rápidos e otimizados (como Gemini 1.5 Flash e GPT-4o mini) e armazenamento inteligente, limitando o custo operacional de IA a no máximo 15% do valor do plano pago pelo cliente (RNF-08).
Privacidade Strict (Compliance LGPD): Todo o tráfego de dados passa por uma sanitização local prévia (Pre-flight Sanitization) no backend antes de tocar servidores terceiros de IA. Nenhum dado pessoal identificável (PII) é enviado para LLMs externas, e os registros de texto das conversas são expurgados do banco de dados físico em 30 dias (RN-PRIV-02).
Resiliência Industrial (Tolerância a Falhas): O sistema opera sob a premissa de que falhas em serviços externos são inevitáveis. Redundância, filas duráveis e políticas de retentativa exponencial (exponential backoff) são implementadas em todas as bordas do ecossistema.
2. Documentos de Contexto e Impactos
2.1. Documentos Anteriores que Impactam este Arquivo
docs/00-visao-geral.md: Fornece o norte estratégico do produto — o foco em PMEs, a experiência analítica em linguagem natural (narrativa comercial) em vez de painéis de gráficos e o canal WhatsApp como fonte primária de dados.
docs/01-roadmap.md: Determina a evolução das fases (Fase 1: Inteligência Analítica, Fase 2: Recomendações Ativas, Fase 3: Automação Assistida, Fase 4: Agentes Autônomos), obrigando a arquitetura a ser flexível e expansível para absorver cada estágio.
docs/02-requisitos.md: Estabelece os limites funcionais de cada fase e define os rigorosos requisitos não funcionais de performance (SLA de ingestão < 2s e resposta de IA < 4s), segurança e escalabilidade (10k requisições/min).
docs/03-regras-de-negocio.md: Impõe as regras operacionais mandatórias de negócios, incluindo as fórmulas matemáticas para SLA útil comercial, regras de atribuição/expiração de leads, taxonomia semântica de perda, limites de planos de assinatura e regras rígidas de LGPD/anonimização.
docs/04-glossario.md: Unifica a nomenclatura técnica e comercial que será utilizada nas entidades de banco de dados e na modelagem do sistema.
2.2. Documentos Futuros que Dependem deste Arquivo
Praticamente todos os documentos especializados de arquitetura (docs/arquitetura/02-stack-tecnologica.md até 18-decisoes-arquiteturais.md) herdarão os padrões e decisões definidos nesta visão geral.
Toda a modelagem de entidades do banco de dados (docs/banco/01-modelagem.md) e os contratos das APIs (docs/backend/03-api.md).
A engenharia de prompts, políticas de RAG e orquestração de IA (docs/ia/).
3. Arquitetura de Referência (Topologia do Sistema)
O VendoraAI adota uma arquitetura baseada em Clean Architecture (Arquitetura Limpa / Hexagonal) para o backend, garantindo que as regras de negócio sejam isoladas de frameworks, bancos de dados e canais de entrega.

O ecossistema geral opera de forma Orientada a Eventos (EDA) e Assíncrona, desacoplando totalmente a recepção transacional de mensagens do WhatsApp do pipeline analítico pesado de Inteligência Artificial.

3.1. Visão Geral da Topologia (Macrocomponentes)
                                  +-----------------------+
                                  |   WhatsApp Cloud API  |
                                  +-----------+-----------+
                                              |
                                              | HTTPS Webhooks
                                              v
                                  +-----------+-----------+
                                  |      API Gateway      |
                                  +-----------+-----------+
                                              |
                                              v
+------------------+              +-----------+-----------+
|   SPA Frontend   | <==========> |    Ingestion Engine   |
| (React / Vue)    |  WebSockets  |   (Backend Worker)    |
+------------------+              +-----------+-----------+
                                              |
                                              | Enfileiramento de Eventos
                                              v
                                  +-----------+-----------+
                                  |    RabbitMQ / Redis   |
                                  |     (Message Broker)  |
                                  +-----+-----------+-----+
                                        |           |
               +------------------------+           +-------------------------+
               | Eventos de Mensagem Ingerida                                 | Eventos de Análise
               v                                                              v
+--------------+---------------+                             +---------------+--------------+
|     Backend Core Engine      |                             |    Analytical AI Engine      |
|  (Clean Arch / Hexagonal)    |                             |  (Orquestrador de Modelos)   |
+--------------+---------------+                             +---------------+--------------+
               |                                                             |
   +-----------+-----------+                                                 |
   |                       |                                                 |
   v                       v                                                 v
+--+-------+           +---+-------+                                     +---+-------+
| Database |           |   Cache   | <=================================> | Vector DB |
| (Postg.) |           |  (Redis)  |             Consulta RAG            | (Chroma/  |
+----------+           +-----------+                                     |  PgVector)|
                                                                         +-----------+
3.2. Descrição dos Componentes do Sistema
API Gateway: Único ponto de entrada para todas as requisições HTTPS e conexões de WebSockets. Gerencia controle de taxa de requisições (rate limiting), barreira de autenticação inicial e telemetria de tráfego.
Ingestion Engine (Worker de Entrada): Microsserviço/Componente ultra-leve e de altíssima performance responsável exclusivamente por receber os webhooks de mensagens brutas do WhatsApp, responder instantaneamente com HTTP 200 OK para o servidor do WhatsApp (garantindo o RNF-02) e publicar a mensagem como um evento bruto na fila de mensageria.
Message Broker (RabbitMQ ou Redis): Camada de mensageria durável responsável por armazenar temporariamente os eventos de mensagens e tarefas em segundo plano. Garante o processamento sequencial e ordenado por conversa e protege o sistema contra picos de tráfego (absorvendo os 10k webhooks/minuto estipulados no RNF-04).
Backend Core Engine (Core de Aplicação): Implementado em arquitetura hexagonal, é responsável por:
Processar regras de negócios síncronas e assíncronas (como cálculo de SLA Útil e atribuição de leads).
Persistir dados de forma confiável no banco transacional.
Executar a Anonimização Prévia (Pre-flight Sanitization), garantindo que dados sensíveis de clientes finais nunca alcancem as APIs externas de IA.
Gerenciar o estado de conexões WebSockets para notificação instantânea do Frontend.
Analytical AI Engine (Orquestrador de IA): Motor responsável por coordenar a interação com LLMs, RAG e embeddings. Consome eventos da fila, recupera contexto histórico, gerencia prompts de forma dinâmica e invoca os modelos de IA, atualizando o sistema de inteligência de forma totalmente isolada do fluxo síncrono.
Relational Database (PostgreSQL): Banco de dados relacional principal que garante consistência ACID. Armazena metadados estruturados, informações de Tenants, vendedores, configurações de expedientes, logs de SLA calculados e resumos comerciais de conversas.
Cache & Session Database (Redis): Armazenamento em memória para sessões de usuários logados, controle de concorrência distribuída, cache temporário de tokens de IA e armazenamento em cache de diagnósticos comerciais rápidos de alta frequência de leitura.
Vector Database (pgvector ou ChromaDB): Utilizado a partir da Fase 3 para busca semântica de alta performance do catálogo de produtos, FAQ organizacional e bases de conhecimento dos Tenants, alimentando de forma assertiva o motor de RAG (Retrieval-Augmented Generation) para rascunhos de resposta automáticos.
4. Fluxo de Dados de Ponta a Ponta (E2E Data Flow)
4.1. Ingestão e Processamento de Conversas (Fase 1: Inteligência Analítica)
Este fluxo descreve o caminho percorrido por uma mensagem enviada por um cliente final até a atualização do painel do vendedor humano e a geração de insights analíticos.

[Cliente] =====WhatsApp=====> [WhatsApp API] =====Webhook=====> [Ingestion Engine]
                                                                        |
                                                         Garante HTTP 200 OK (< 2s)
                                                                        v
                                                                 [Message Broker]
                                                                        |
                                                             Consome Evento Assíncrono
                                                                        v
                                                             [Backend Core Engine]
                                                                        |
                                                     * Calcula SLA Útil (RN-SLA-02)
                                                     * Associa Vendedor (RN-LEAD-01)
                                                     * Executa Sanitização (RN-PRIV-01)
                                                                        |
                                                      +-----------------+-----------------+
                                                      |                                   |
                                             Grava no Postgres                     Publica na Fila
                                                      v                                   v
                                              [PostgreSQL DB]                    [Analytical AI Engine]
                                                                                          |
                                                                               Envia Payload Anonimizado
                                                                                          v
                                                                                   [Modelos de LLM]
                                                                                    (Gemini / OpenAI)
                                                                                          |
                                                                                Classifica Motivo de
                                                                                   Perda e Sentimento
                                                                                          |
                                                                                          v
[Vendedor] <=====Notifica WebSocket===== [Backend Core] <====Grava no Postgres==== [Analytical AI Engine]
Passo a Passo Detalhado:
Recepção do Webhook: O cliente envia uma mensagem no WhatsApp. O WhatsApp Cloud API dispara um webhook HTTPS POST contendo o JSON com o remetente, timestamp e conteúdo do texto bruto.
Confirmação Instantânea: O Ingestion Engine valida estruturalmente o payload, escreve o evento na fila webhook.whatsapp.raw e retorna imediatamente HTTP 200 OK ao WhatsApp. O tempo máximo deste ciclo deve ser inferior a 2 segundos para evitar retentativas redundantes por parte do servidor do WhatsApp (RNF-02).
Consumo e Sanitização: O Backend Core Engine consome o evento bruto da fila:
Realiza a identificação do Tenant correspondente.
Aplica o filtro de Expediente Comercial (RN-SLA-02) para calcular o cronômetro de SLA útil ativo.
Associa o lead ao vendedor responsável pelo atendimento (ou o define como não atribuído/fila de triagem).
Executa localmente o script de Sanitização Prévia (RN-PRIV-01) (com regex e dicionários de dados), mascarando CPFs, contas bancárias e dados confidenciais do cliente.
Persiste a mensagem na tabela messages do PostgreSQL.
Análise de Inteligência (Assíncrona): O backend publica a mensagem sanitizada na fila analysis.message.pending. O Analytical AI Engine consome este evento:
Agrupa a mensagem aos logs históricos recentes daquela conversa.
Dispara uma chamada de API ao LLM de menor latência (Gemini 1.5 Flash ou GPT-4o mini) com prompts específicos de classificação semântica (motivos de perda, sentimento e intenções).
O LLM retorna a classificação. Se a confiança for inferior a 85%, o motor atribui o fallback "OUTROS" e sinaliza para revisão humana (RN-SEM-03).
Consolidação e Atualização UI: O resultado analítico compilado é gravado na tabela conversations_metrics e o Backend Core Engine dispara um evento de WebSocket informando à SPA do Frontend que novas métricas estão disponíveis. A tela do vendedor atualiza dinamicamente e sem recarregamentos em menos de 2 segundos após a decisão da IA (RNF-02).
5. Padrões de Arquitetura e Engenharia de Software
5.1. Bounded Contexts (DDD Tático e Separação de Domínios)
Para manter o acoplamento baixo e facilitar o desenvolvimento modular por equipes ou agentes de IA, o sistema é segmentado nos seguintes subdomínios (Contextos Delimitados):

Tenant & Identity Context: Gerencia o cadastro de organizações (PMEs), usuários (Admins/Vendedores), controle de acesso baseado em papéis (RBAC) e as regras de precificação/limites de planos (RN-COB-01).
Ingestion Context: Focado estritamente na borda de recepção de webhooks do WhatsApp, validação de payloads e persistência temporária na fila de mensageria.
Lead & Conversation Context: Gerencia o ciclo de vida do contato, regras de transição de status (Lead Ativo, Esfriando, Frio, Inativo), atribuição de vendedores humanos e cálculo exato de SLAs de resposta ajustados com o expediente comercial útil.
Intelligence Context (AI Core): Orquestra prompts, gerencia o fluxo de contexto de LLM, executa buscas em Banco de Dados Vetorial (RAG) e compila as análises em relatórios narrativos escritos em linguagem natural para o gestor comercial.
Compliance Context (Security & Anonymization): Domínio responsável pela segurança estrita. Roda localmente o pipeline de higienização de texto e gerencia a rotina de limpeza permanente (purge físico) de conversas brutas após 30 dias de armazenamento (RN-PRIV-02).
5.2. Padrões de Design e Boas Práticas
Ports and Adapters (Arquitetura Hexagonal): A lógica interna do negócio (Cálculos de SLA, regras de expiração de leads) não possui dependência direta de tecnologias como o PostgreSQL, Redis ou frameworks HTTP. Toda a infraestrutura externa é consumida por meio de Portas (Interfaces) e Adaptadores de Infraestrutura, facilitando testes de unidade sem acoplamento.
Clean Code & SOLID: Classes focadas em responsabilidade única. A criação ou remoção de canais de IA ou novos canais de mensageria não devem interferir na lógica de faturamento ou de SLA do sistema.
Twelve-Factor App: Configurações injetadas estritamente por variáveis de ambiente, processos sem estado (stateless), logs canalizados para stdout e isolamento estrito de dependências.
6. Governança de Segurança, Privacidade e LGPD
O VendoraAI adota uma postura agressiva e proativa em relação à segurança cibernética e privacidade dos dados de conversas de PMEs, protegendo o ecossistema contra vazamentos de informações comerciais estratégicas.

6.1. Anonimização Local (Pre-flight Sanitization)
Conforme estabelecido pela RN-PRIV-01, nenhuma mensagem bruta é despachada para APIs de IA externas sem passar pela camada de higienização local.

Fase de Interceptação: No Backend Core, antes do disparo do payload JSON para a OpenAI/Google, o texto da conversa é analisado contra bibliotecas e padrões de expressão regular (Regex) otimizados localmente.
Mascaramento: CPFs, CNPJs, dados de cartões de crédito e informações confidenciais são convertidos em placeholders de tamanho fixo, impossibilitando que modelos públicos de IA usem esses dados para aprendizado ou os exponham em furos de segurança corporativa.
6.2. Política de Retenção Física Limitada (Purge de 30 Dias)
A plataforma não armazena textos de conversas indeterminadamente (RN-PRIV-02).

Objetivo: Mitigar riscos legais sob a LGPD e reduzir drasticamente os custos e requisitos de espaço físico em bancos de dados relacionais e backups frios.
Janela Temporal: As conversas brutas permanecem acessíveis na tabela messages por exatos 30 dias corridos para suportar a contextualização de RAG e refinamentos analíticos locais.
Mecanismo de Expurgo: Um job automatizado de backend roda diariamente varrendo o banco de dados. Todas as mensagens com created_at superior a 30 dias têm seus campos de texto substituídos por strings vazias ou nulas.
Preservação de Inteligência: Apenas os metadados agregados (SLA de resposta calculado, vendedor associado, categoria de perda semântica, data da ocorrência e o resumo textual resumido gerado pela IA) são mantidos permanentemente para fins de relatórios analíticos de longo prazo do gestor.
7. Registro de Decisões Arquiteturais (ADRs recomendados)
Com base nas definições estabelecidas nesta visão geral de arquitetura, recomenda-se a criação imediata dos seguintes ADRs (Architecture Decision Records) na pasta docs/adr/ para formalizar as justificativas de engenharia:

ADR-001: Padrão de Organização Arquitetural (Backend)
Objetivo: Formalizar o uso de Clean Architecture e DDD tático como o padrão oficial de escrita de código do backend do VendoraAI, definindo a estrutura de pastas e as dependências entre camadas de domínio, aplicação e infraestrutura.
ADR-002: Arquitetura de Processamento Assíncrono e Mensageria
Objetivo: Comparar alternativas de Message Brokers (RabbitMQ vs Redis Pub-Sub/Queues) e justificar a escolha tecnológica para sustentar as filas duráveis do fluxo de ingestão e processamento assíncrono de IA, respeitando o RNF-04 (10k requisições/min).
ADR-003: Escolha do Banco de Dados Relacional e Vetorial
Objetivo: Justificar a seleção do PostgreSQL como repositório relacional estruturado e comparar mecanismos vetoriais (extensão pgvector acoplada ao Postgres vs bancos vetoriais dedicados como ChromaDB ou Pinecone) para dar suporte à infraestrutura de RAG na Fase 3 do roadmap.
ADR-004: Estratégia de Anonimização e LGPD no Pipeline de IA
Objetivo: Detalhar tecnicamente a modelagem e a biblioteca de mascaramento de dados (como Microsoft Presidio ou regex customizado de alta performance no backend) e formalizar o desenho do job diário de purge físico das conversas após 30 dias.
8. Próximos Passos na Documentação
O desenvolvimento do ecossistema de documentação deve prosseguir de forma sequencial para garantir que cada etapa técnica tenha o devido suporte lógico:

docs/arquitetura/02-stack-tecnologica.md (Imediato): Escolha detalhada e justificativa de cada tecnologia sugerida neste modelo (Linguagens de programação, frameworks, bancos, serviços de IA de terceiros e monitoramento).
docs/arquitetura/03-arquitetura-backend.md: Detalhamento da organização de camadas, roteamento de APIs, controllers, handlers e ports do Core Engine.
docs/arquitetura/05-arquitetura-banco.md: Detalhes de modelagem transacional e índices de performance.
docs/arquitetura/08-arquitetura-ia.md: Estrutura profunda de orquestração de prompts, consumo de tokens, controle de custos de LLM e integração vetorial.