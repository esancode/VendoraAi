Regras de Negócio (docs/03-regras-de-negocio.md)
Este documento estabelece as Regras de Negócio (RN) que regem o comportamento operacional, os cálculos métricos e os limites de conformidade do VendoraAI. Estas regras servem como especificações lógicas mandatórias para a implementação do backend, frontend e dos motores de Inteligência Artificial.

1. Regras de SLA de Resposta (RN-SLA)
O Service Level Agreement (SLA) de tempo de resposta é a métrica central de diagnóstico do VendoraAI. Ele mede a eficiência com que a equipe de vendas atende os potenciais clientes no WhatsApp.

RN-SLA-01: Cálculo de Tempo de Resposta Único
O tempo de resposta para uma mensagem individual do cliente é calculado como a diferença de tempo entre a primeira mensagem enviada pelo cliente e a primeira resposta subsequente do vendedor.

Fórmula: $$\Delta t_{resposta} = t_{vendedor} - t_{cliente}$$
Regra de Gatilho: Uma mensagem do cliente só inicia um cronômetro de SLA se o vendedor não for o último a ter enviado uma mensagem na conversa. Mensagens consecutivas do cliente antes de uma resposta do vendedor acumulam-se sob o carimbo de data/hora ($t_{cliente}$) da primeira mensagem sem resposta do bloco.
RN-SLA-02: Filtro de Horário Comercial Comercial (SLA Ajustado)
O cálculo do SLA de resposta deve ignorar períodos fora do horário comercial configurado para a empresa do cliente (Tenant).

Configuração por Tenant: Cada empresa define seus dias de funcionamento (ex: Segunda a Sexta) e janelas diárias (ex: 08:00 às 18:00).
Regra de Pausa: Se uma mensagem do cliente for recebida fora do horário de expediente, o cronômetro de SLA permanece pausado e só inicia a contagem no primeiro minuto do próximo expediente útil.
Fórmula do SLA Útil: $$\Delta t_{SLA_Util} = \Delta t_{total} - \sum t_{fora_do_expediente}$$
RN-SLA-03: Média de SLA Consolidada (Tenant e Vendedor)
A métrica de tempo médio de resposta apresentada nos relatórios narrativos e de performance segue a média aritmética das respostas úteis dentro de um período selecionado.

Fórmula: $$SLA_{medio} = \frac{\sum_{i=1}^{n} \Delta t_{SLA_Util_i}}{n}$$ Onde $n$ é o número total de interações respondidas no período analisado.
2. Regras de Atribuição e Ciclo de Vida do Lead (RN-LEAD)
Estas regras regulam como o sistema lida com o ciclo de vida dos contatos comerciais capturados via WhatsApp.

RN-LEAD-01: Atribuição Automática de Vendedor (Responsabilidade)
Para fins de auditoria de performance individual de vendas, todo lead integrado ao sistema precisa estar associado a um vendedor (membro do Tenant).

Primeiro Contato: O lead é automaticamente atribuído ao primeiro vendedor humano que responder à sua mensagem inicial no WhatsApp.
Substituição Manual: Administradores podem transferir explicitamente a titularidade do lead para outro vendedor ativo.
Janela de Atendimento: Se um lead retornar após a expiração (ver RN-LEAD-02) e for atendido por outro vendedor, a titularidade é transferida automaticamente para o novo vendedor que realizou o atendimento.
RN-LEAD-02: Regra de Expiração e Lead Frio (Status de Inatividade)
Para evitar cálculos infinitos de SLA e poluição de análises semânticas, as conversas são categorizadas por atividade.

Lead Ativo: Qualquer conversa com interação bidirecional nas últimas 24 horas.
Lead Esfriando (Alerta Ativo): Conversa sem resposta do vendedor há mais de 2 horas (durante o horário comercial). Dispara o requisito RF-05 (Alerta de Resfriamento).
Lead Frio: Conversas sem nenhuma nova interação de ambas as partes (vendedor ou cliente) há mais de 48 horas úteis.
Lead Arquivado/Inativo: Conversas sem interação há mais de 7 dias úteis. São descartadas dos cálculos de SLA pendentes.
3. Regras de Classificação Semântica de Perda (RN-SEM)
Define a lógica de negócios por trás do motor de IA que categoriza por que as vendas não foram fechadas.

RN-SEM-01: Gatilho de Reconhecimento de Perda
Uma conversa é classificada como "Perdida" (Lost) quando preencher um dos seguintes critérios:

Declaração Explícita de Desistência: O cliente envia uma mensagem recusando o produto/serviço (ex: "não tenho interesse", "ficou caro", "comprei com outro", "vou deixar para a próxima").
Inatividade Crítica: O lead torna-se Frio (48 horas úteis de silêncio do cliente após uma proposta ou tentativa de fechamento pelo vendedor).
Marcação Manual: O vendedor altera o status do lead para "Perdido" no painel da plataforma.
RN-SEM-02: Categorização Semântica Obrigatória (Taxonomia Comercial)
O motor de processamento de linguagem natural (LLM) deve classificar a perda em uma das categorias padronizadas do VendoraAI:

PRECO (Objeção de preço, falta de orçamento).
PRAZO (Tempo de entrega longo, indisponibilidade imediata).
CONCORRENCIA (Fechou com concorrente ou preferiu outra marca).
PRODUTO_INCOMPATIVEL (Falta de funcionalidades específicas, tamanho/modelo errado).
ATENDIMENTO (Demora extrema no atendimento que causou perda de interesse).
OUTROS (Fallback quando o motivo for inconclusivo).
RN-SEM-03: Regra de Fallback e Consistência Semântica
Se o LLM não conseguir extrair o motivo com mais de 85% de confiança (Score de Confiança), a categoria padrão atribuída será OUTROS, e um sinalizador de "Necessita Revisão Humana" será associado ao registro de perda no banco de dados.

4. Regras de Cobrança, Limites e Consumo (RN-COB)
Garante o controle financeiro do modelo SaaS e mitiga abusos ou prejuízos operacionais decorrentes do consumo de APIs de IA.

RN-COB-01: Limites por Plano de Assinatura
O sistema deve aplicar limites estritos de volume de mensagens analisadas e número de assentos (vendedores cadastrados) de acordo com o plano do cliente:

Recurso	Plano Starter (PMEs)	Plano Growth (Escala)	Plano Enterprise (Custom)
Limites de Vendedores	Até 3 vendedores	Até 10 vendedores	Ilimitado
Mensagens Analisadas /mês	Até 5.000 mensagens	Até 25.000 mensagens	Customizado
Relatórios Narrativos /mês	Diário / Semanal	Diário / Semanal / Mensal	Customizado / Sob Demanda
Consultas RAG de IA (Rascunhos)	Indisponível	Até 1.500 rascunhos	Ilimitado (sob cota contratual)
RN-COB-02: Regra de Bloqueio por Consumo Crítico
Se um Tenant atingir 100% de sua cota mensal de mensagens analisadas ou requisições de IA:

Notificação: Disparar alerta automático de fim de franquia para o e-mail do proprietário e dentro da aplicação web aos 80% e 100% de uso.
Suspensão Parcial: O processamento de novas mensagens pela IA é interrompido. Os dados operacionais históricos e relatórios já gerados continuam acessíveis.
Faturamento Incremental: O cliente pode optar por comprar "pacotes de mensagens adicionais" ou realizar o upgrade imediato de plano para reativar a IA instantaneamente.
5. Regras de Privacidade e Segurança de Dados (RN-PRIV)
Determina o comportamento lógico de proteção à privacidade das empresas e de seus clientes finais, em estrita conformidade com a LGPD.

RN-PRIV-01: Anonimização de Dados Sensíveis (Pre-flight Sanitization)
Antes de qualquer payload de texto de conversas do WhatsApp ser despachado para APIs externas de Inteligência Artificial (ex: OpenAI, Anthropic), um processamento local de sanitização (regex e NLP locais) deve remover ou mascarar:

CPFs e CNPJs: Mascarados para [CPF_REDACTED] e [CNPJ_REDACTED].
Dados Financeiros (Cartões, Contas): Substituídos por [CARD_REDACTED] ou [FINANCE_REDACTED].
Dados Pessoais Sensíveis: Qualquer dado referente a saúde, religião ou posicionamento político deve ser expurgado do payload de análise semântica.
Nomes e Telefones: Substituídos por tokens genéricos (ex: Cliente [ID_ANON] / Vendedor [ID_ANON]) para preservar o fluxo de diálogo sem expor dados identificáveis.
RN-PRIV-02: Retenção de Dados de Conversa
Os registros brutos de texto de conversas ingeridos via WhatsApp têm prazo de validade estrito para armazenamento físico.

Janela Máxima de Análise: O texto bruto das conversas pode ser armazenado por no máximo 30 dias para fins de treinamento de RAG local do Tenant ou reprocessamento semântico.
Expurgo Permanente: Após 30 dias, os diálogos brutos devem ser excluídos permanentemente de todas as tabelas de banco de dados ativos e backups frios, restando no banco de dados apenas os metadados estatísticos e o resumo condensado da transação (ex: SLA, Motivo de Perda compilado, Vendedor associado, data).
6. Matriz de Rastreabilidade (Requisitos vs Regras)
A tabela abaixo conecta as Regras de Negócio definidas neste documento aos Requisitos Funcionais estruturados em docs/02-requisitos.md:

Código da Regra	Descrição Sumária	Requisito Relacionado
RN-SLA-01	Cálculo de SLA de Resposta	RF-02 (Mapeamento de SLA e Ociosidade)
RN-SLA-02	Filtro de Horário Comercial	RF-02 (Mapeamento de SLA e Ociosidade)
RN-SLA-03	Média de SLA Consolidada	RF-04 (Geração de Relatórios Narrativos)
RN-LEAD-01	Atribuição de Vendedor	RF-01 (Captura Assíncrona), RF-12 (Triagem e Qualificação)
RN-LEAD-02	Expiração de Contatos	RF-05 (Alertas Ativos de Leads Esfriando)
RN-SEM-01	Gatilho de Reconhecimento de Perda	RF-03 (Identificação Semântica de Motivos)
RN-SEM-02	Categorias de Perda Padronizadas	RF-03 (Identificação Semântica de Motivos)
RN-SEM-03	Regra de Fallback Semântico	RF-03 (Identificação Semântica de Motivos)
RN-COB-01	Limites por Plano de Assinatura	RNF-08 (Eficiência de Custo e Token-saving)
RN-COB-02	Suspensão por Consumo Crítico	RNF-08 (Eficiência de Custo e Token-saving)
RN-PRIV-01	Anonimização de Dados Sensíveis	RNF-01 (Criptografia, LGPD e Privacidade)
RN-PRIV-02	Janela de Retenção de 30 Dias	RNF-01 (Criptografia, LGPD e Privacidade)