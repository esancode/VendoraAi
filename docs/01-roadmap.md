VendoraAI: Roadmap Estratégico de Produto e Engenharia
docs/01-roadmap.md
Metadado	Detalhe
Versão	1.0
Status	Em planejamento
Escopo	Planejamento de Ciclo de Vida e Entregas Incrementais
Autor	Arquiteto-Chefe
1. Objetivos do Roadmap
O roadmap do VendoraAI é desenhado para conciliar a necessidade crítica de rápida validação de mercado com uma evolução técnica robusta, de baixo custo e altamente escalável. Para que uma startup operando no modelo SaaS Recorrente seja sustentável, o tempo para gerar o primeiro "Aha! Moment" (momento de valor percebido) para o cliente deve ser o menor possível.

A estratégia técnica divide a complexidade do sistema em quatro fases estagiadas. Isso nos permite coletar dados operacionais reais dos clientes nas primeiras fases para que possamos construir algoritmos de IA preditivos e agentes autônomos extremamente assertivos nas fases posteriores, eliminando riscos de alucinação e custos desnecessários com tokens de LLMs em funcionalidades não validadas.

2. Alinhamento com os Princípios do Produto
Cada fase de desenvolvimento está rigorosamente mapeada para sustentar os princípios definidos na visão geral do produto:

Gerar Lucro para o Cliente: Fases iniciais atacam diretamente as perdas de faturamento mais óbvias (demora na resposta e falta de follow-up).
Simplicidade Radical: A complexidade analítica da IA é escondida por trás de uma interface limpa que se comunica por meio de insights textuais claros.
Inteligência Antes de Automação: Primeiro compreendemos semanticamente a dinâmica comercial de cada nicho de cliente para só depois propor automações seguras.
IA como Assistente Co-Piloto: O controle decisório é sempre mantido na mão do gestor ou do vendedor humano, mitigando riscos de erros em interações comerciais cruciais.
3. Fases de Evolução do Produto
+---------------------------------------------------------------------------------+
|                                 VENDORA AI                                      |
+---------------------------------------------------------------------------------+
|                                                                                 |
|  [ Fase 1: Inteligência Analítica ] ---> [ Fase 2: Sugestões Ativas ]           |
|  (Processamento e Gargalos de Conversão) (Abordagens e Alertas de Leads Frios)  |
|                                                     |                           |
|                                                     v                           |
|  [ Fase 4: Agentes Autônomos ]      <--- [ Fase 3: Automação Assistida ]        |
|  (Follow-up Executado por IA com     (Geração de Rascunhos e Resumos Rápidos)   |
|   Supervisão Humana)                                                            |
|                                                                                 |
+---------------------------------------------------------------------------------+
Fase 1: Inteligência Analítica (Foco do MVP e V1.0)
Objetivo: Oferecer visibilidade total sobre o fluxo de vendas do WhatsApp sem exigir nenhuma automação ativa de envio de mensagens ou digitação de CRMs por parte da equipe.
Entregas de Produto:
Dashboard de Diagnóstico de SLA: Exposição do tempo de resposta por vendedor e alertas de faturamento perdido decorrente do tempo de espera elevado.
Identificador Semântico de Perda de Leads: Classificação automática do motivo de encerramento ou abandono das conversas (Ex: Objeção de preço, falta de estoque de produto específico, indisponibilidade de agenda).
Mapeamento de Demanda Descoberta: Análise automática de produtos consultados que não constam no portfólio da empresa.
Análise de Sentimento de Leads: Monitoramento da temperatura e nível de engajamento do cliente nas últimas interações.
Escopo de Engenharia e IA:
Ingestão assíncrona do histórico de mensagens de WhatsApp via Webhook de provedor oficial.
Classificação de intenções e entidades utilizando LLMs de menor latência e custo-eficientes (como Gemini 1.5 Flash ou GPT-4o mini).
Processamento assíncrono (Background Jobs) de mensagens para evitar concorrência com o fluxo transacional do banco de dados operacional.
Geração de rascunhos de diagnósticos comerciais de forma passiva e armazenada em cache para carregamento instantâneo.
Fase 2: Recomendações e Sugestões Ativas
Objetivo: Transformar a plataforma de uma ferramenta reativa (diagnóstico) para uma ferramenta proativa que direciona ativamente o vendedor e o gestor para onde concentrar esforços imediatos.
Entregas de Produto:
Alerta de Leads Esfriando (Urgente): Identificação e priorização em tela de conversas paradas onde o cliente demonstrou alta intenção de compra, mas não recebe interação há mais de "X" horas.
Sugestões Personalizadas de Abordagem: Análise em tempo real do histórico de vendas bem-sucedidas do mesmo vendedor ou de vendedores campeões para sugerir gatilhos mentais ideais de fechamento (Ex: Escassez, prova social).
Dicas de Contorno de Objeções: Sempre que a IA classificar semanticamente uma objeção ("Está caro", "Vou falar com meu cônjuge"), o sistema sugere roteiros provados de contorno específicos para aquele nicho de negócio.
Escopo de Engenharia e IA:
Engenharia de Contexto Dinâmica (Dynamic Context Prompting) injetando o perfil do nicho de mercado e as diretrizes do produto no prompt da IA.
Implementação de WebSockets no Frontend para envio de notificações em tempo real e alteração dinâmica da prioridade das conversas.
Sistema de cache distribuído em memória para identificar de forma instantânea os desvios de SLA em conversas abertas.
Fase 3: Automação Assistida
Objetivo: Otimizar radicalmente o tempo operacional gasto pelo vendedor na digitação de mensagens longas, explicações repetitivas e atualização de status de atendimento.
Entregas de Produto:
Geração Inteligente de Rascunhos de Resposta (Drafts): A IA gera propostas de respostas inteiras baseadas nas dúvidas do cliente e nos catálogos internos de produtos, deixando pronto para o vendedor revisar, editar e enviar com um único clique.
Resumo de Conversas Longas: Se um lead é transferido de atendente, a IA gera um resumo executivo em tópicos de tudo o que foi conversado previamente, evitando que o cliente repita informações.
Preenchimento Inteligente de Campos: Extração semântica de dados cadastrais (Nome, Telefone, E-mail, Endereço, Produto de Interesse) para preenchimento automático no banco de dados e sincronizações externas.
Escopo de Engenharia e IA:
Uso de arquitetura de RAG (Retrieval-Augmented Generation) acoplada aos documentos de inventário, catálogos de produtos e regras de negócio da empresa para prover respostas fidedignas.
Infraestrutura de banco de dados vetorial para busca semântica rápida do portfólio de produtos e FAQ institucional.
APIs REST dedicadas para entrega e consumo de rascunhos de forma síncrona de baixa latência (< 1.5s).
Fase 4: Agentes Comerciais Autônomos
Objetivo: Permitir que rotinas repetitivas de vendas e follow-up pós-venda de baixa complexidade rodem de forma autônoma sob supervisão de IA, liberando o time comercial humano exclusivamente para negociações de alto ticket.
Entregas de Produto:
Follow-up Autônomo de Leads Frios: Interação inteligente e humanizada via WhatsApp para reengajar clientes que pararam de responder há semanas, qualificando-os antes de repassar para o vendedor humano.
Agendamento de Visitas e Consultas: Integração do agente de IA com sistemas de agenda (Google Calendar, agendas internas) para realizar agendamentos, remarcações e cancelamentos automáticos por mensagem.
Qualificação Inicial Automatizada: IA conversa inicialmente com novos leads de canais de marketing para validar fit comercial e direcioná-los ao vendedor humano ideal.
Escopo de Engenharia e IA:
Orquestração avançada de agentes baseada em LangGraph ou frameworks orientados a eventos, controlando o estado conversacional.
Sistemas robustos de Guardrails de Segurança contra abusos, alucinações e comportamentos indesejados (Ex: Concessão inapropriada de descontos).
Auditoria em tempo real com "Human-in-the-Loop" onde ações críticas do agente requerem confirmação prévia no painel antes de serem disparadas no WhatsApp.
4. Critérios de Transição de Fase
A passagem de uma fase técnica de desenvolvimento para a próxima não se baseia estritamente em prazos corridos, mas sim em metas de produto e engenharia bem-definidas:

De Fase	Para Fase	Critério de Transição Estratégico
Fase 1	Fase 2	* Ingestão diária estável de > 500.000 mensagens sem travamentos de fila.* Acurácia da classificação de motivos de perda superior a 88% avaliada por auditorias humanas.* Churn mensal de clientes pioneiros (Beta) inferior a 3.5%.
Fase 2	Fase 3	* Vendedores interagem com os alertas de follow-up (taxa de aceitação/ação superior a 60%).* Latência do WebSocket estável sob carga pesada (SLA < 150ms).* Acurácia na sugestão de contornos de objeções de vendas aprovada por amostragem.
Fase 3	Fase 4	* Rascunhos de respostas gerados pela IA são aproveitados "sem edições" em mais de 50% dos casos.* Custo médio de tokens por conversa reduzido em 40% através de compressão de contexto e cache de prompt.* Base de conhecimento vetorial (RAG) consolidada com índice de falha de busca semântica próximo a zero.
5. Gestão de Escopo e Trade-offs de Engenharia
Para viabilizar a entrega robusta sob a filosofia de MVP e SaaS recorrente, as seguintes decisões técnicas e de produto foram tomadas como trade-offs explícitos:

Exclusão de Aplicativo Nativo (Fase 1 e 2): Foco estrito em SPA Web Responsiva. Menor sobrecarga de desenvolvimento, atualizações em tempo real e controle total da latência de conexão pelo navegador.
No-Code Config na Fase 1: Toda a ingestão dependerá de conexões simplificadas (QR Code via API parceira ou tokens oficiais do WhatsApp Cloud API), sem integrações profundas com ERPs legados de clientes neste momento.
Processamento Event-Driven e Filas: Não faremos requisições diretas e demoradas de IA na requisição HTTP principal do webhook de entrada. Mensagens serão jogadas em filas assíncronas (RabbitMQ/Redis-based queues) para garantir resiliência e evitar que estouros de latência de APIs externas de IA derrubem o servidor de webhooks de mensagens.
6. Análise de Impacto e Dependências
Documentos anteriores que impactam este arquivo:
docs/00-visao-geral.md: Define os princípios conceituais do produto que balizam a priorização deste roadmap.
Documentos futuros que dependerão deste arquivo:
docs/02-requisitos.md: Deverá estruturar e detalhar minuciosamente os Requisitos Funcionais (RF) e Requisitos Não Funcionais (RNF) correspondentes a cada uma das etapas demarcadas, garantindo que o escopo de engenharia não sofra com scope creep.
docs/03-regras-de-negocio.md: Definirá as regras estruturais (por exemplo, as regras de atribuição de leads e SLAs de atendimento) para a Fase 1 e Fase 2.
docs/arquitetura/01-visao-geral.md: Mapeará as premissas de transição tecnológica, arquitetura de filas e resiliência de canais assíncronos descritos nas Fases 1 e 2.
docs/ia/01-visao-geral.md: Irá detalhar as evoluções de modelos de NLP, embeddings e orquestrações das Fases 1, 2, 3 e 4.
Necessidade de criação ou atualização de ADRs:
Este arquivo dita a progressão estratégica de produto, portanto, não requer a criação imediata de ADRs de infraestrutura. No entanto, as diretrizes de processamento assíncrono via filas e o uso de bancos vetoriais previstos para as Fases 1 e 3 antecipam a necessidade de ADRs de Arquitetura de Fila (docs/adr/ADR-002.md) e de Escolha de Banco de Dados Vetorial (docs/adr/ADR-003.md) quando iniciarmos os detalhamentos técnicos do diretório docs/arquitetura/.