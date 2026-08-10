Glossário do Projeto: VendoraAI
Este documento consolida e define formalmente a terminologia técnica, de negócios e de Inteligência Artificial utilizada em todo o ecossistema do VendoraAI. O objetivo é unificar o vocabulário para nivelar o entendimento entre engenheiros humanos, gerentes de produto, parceiros de negócios e agentes autônomos (IAs) de desenvolvimento.

1. Termos de Negócios e Vendas (Business & Sales)
Tenant (Organização / Cliente SaaS)
Definição: Entidade jurídica (PME - Pequena ou Média Empresa) que assina a plataforma VendoraAI.
Contexto: O sistema é multi-tenant, o que significa que múltiplos Tenants compartilham a mesma infraestrutura de software de forma isolada, garantindo total privacidade e segregação de dados entre diferentes empresas.
Lead (Oportunidade de Negócio)
Definição: Um cliente em potencial que inicia um contato de compra por meio do canal de WhatsApp integrado. No VendoraAI, um Lead é caracterizado e rastreado no banco de dados a partir do momento em que envia uma mensagem de intenção comercial, sendo vinculado a um número de telefone específico e a um vendedor do Tenant.
SLA de Resposta (Service Level Agreement)
Definição: Tempo decorrido entre a última mensagem enviada pelo Lead (cliente) e a primeira resposta enviada pelo vendedor humano ou agente virtual. É a métrica mais crítica monitorada pela plataforma para avaliar a eficiência comercial.
SLA Útil (Horário Comercial)
Definição: O cálculo do SLA de resposta que considera estritamente o horário de expediente cadastrado pelo Tenant.
Contexto: Se um Lead envia uma mensagem às 22h00 de um domingo e o expediente comercial do Tenant começa na segunda-feira às 08h00, o tempo decorrido até às 08h00 é zerado. Se o vendedor responder às 08h15, o SLA de resposta útil será de 15 minutos, e não de 10 horas e 15 minutos.
Lead Frio / Esfriamento de Lead
Definição: Estado em que um Lead ativo não recebe uma resposta do vendedor dentro do tempo ideal estipulado pelas regras de negócio.
Contexto: No VendoraAI, o tempo padrão para acionar um alerta de "esfriamento" é de 2 (duas) horas após o recebimento da última mensagem sem resposta comercial útil.
Lead Perdido (Perda Semântica)
Definição: Um Lead que teve sua interação comercial encerrada sem conversão em venda. O motivo do encerramento é categorizado de forma automática pelo motor de Inteligência Artificial através da análise do histórico da conversa.
Motivos Semânticos de Perda
Definição: Categorias padronizadas para agrupamento das vendas não concretizadas.
Contexto: O motor de IA classifica cada perda comercial sob uma taxonomia fechada: Preço (preço alto, falta de desconto), Prazo (demora na entrega), Produto (falta de estoque ou variação), Concorrência (fechou com concorrente) ou Atendimento (demora crítica no contato).
2. Termos Técnicos e de Arquitetura de Software
SPA (Single Page Application)
Definição: Aplicação web construída em uma única página que atualiza seus elementos de interface dinamicamente à medida que o usuário interage com ela, sem a necessidade de recarregar a página inteira a partir do servidor.
Contexto: O painel administrativo do VendoraAI é uma SPA responsiva, projetada para funcionar com excelente desempenho tanto em desktops quanto em navegadores de smartphones.
Webhook
Definição: Mecanismo de comunicação entre sistemas baseado em eventos, onde uma aplicação envia dados em tempo real para outra URL configurada assim que um evento específico ocorre.
Contexto: A API do WhatsApp (ex: WhatsApp Business Cloud API) dispara webhooks para o backend do VendoraAI sempre que uma nova mensagem é recebida ou enviada.
Ingestão Assíncrona
Definição: Arquitetura de processamento onde a recepção das mensagens não bloqueia a conexão. Os dados de entrada são rapidamente salvos em uma fila e o remetente recebe uma resposta de confirmação imediata, enquanto o processamento analítico pesado ocorre em segundo plano.
Contexto: Garante que o VendoraAI consiga processar picos intensos de mensagens do WhatsApp sem sofrer com lentidão ou perda de dados.
WebSocket
Definição: Protocolo de comunicação bidirecional em tempo real que mantém uma conexão TCP aberta entre o cliente (frontend) e o servidor (backend).
Contexto: Usado no VendoraAI para empurrar atualizações instantâneas de status dos leads e alertas de resfriamento na tela do usuário logado na SPA.
API Gateway
Definição: Um ponto de entrada único para o sistema que intercepta todas as requisições de clientes API, gerencia roteamentos, autenticação, controle de tráfego e telemetria.
Cache (Redis)
Definição: Camada de armazenamento de dados temporária de altíssima velocidade (em memória).
Contexto: Utilizada para guardar sessões de usuários ativos, parâmetros de configuração dos Tenants, e caches de tokens para reduzir requisições custosas ao banco de dados relacional.
Mensageria (Fila de Mensagens / Message Broker)
Definição: Sistema que gerencia a comunicação assíncrona entre diferentes serviços por meio de buffers temporários (filas).
Contexto: O VendoraAI utiliza filas para receber mensagens brutas do WhatsApp, enviá-las para anonimização, processá-las semanticamente com LLM e atualizar os históricos de conversação de maneira ordenada e tolerante a falhas.
Rate Limit (Limite de Requisições)
Definição: Mecanismo de segurança que limita o número de requisições que um determinado usuário, IP ou Tenant pode realizar na API dentro de uma janela de tempo.
Contexto: Protege a API contra ataques de negação de serviço (DoS) e controla o abuso na chamada de recursos computacionais caros.
ADR (Architecture Decision Record)
Definição: Documento curto que registra uma decisão arquitetural significativa tomada no projeto, incluindo o contexto, a decisão, as opções avaliadas e as consequências decorrentes dela.
RBAC (Role-Based Access Control)
Definição: Mecanismo de segurança de controle de acesso baseado em papéis (funções/cargos) atribuídos aos usuários. No VendoraAI, os papéis padrão de um Tenant incluem Admin (visão global e configurações) e Vendedor (visualiza e gerencia apenas suas próprias interações comerciais).
3. Termos de Inteligência Artificial e LLMs
LLM (Large Language Model)
Definição: Modelo de rede neural artificial treinado em gigantescos volumes de dados textuais para entender, gerar, resumir e traduzir linguagem natural de forma contextualizada. No VendoraAI, os LLMs são consumidos sob demanda para analisar conversas comerciais.
RAG (Retrieval-Augmented Generation)
Definição: Técnica que otimiza a geração de respostas por um LLM ao consultar fontes externas de dados atualizados (como uma base de conhecimento do Tenant) antes de formular a resposta final.
Contexto: Garante que as sugestões de mensagens geradas pelo VendoraAI na Fase 3 se baseiem estritamente em dados reais e atualizados de produtos, preços e políticas da empresa cliente, eliminando alucinações da IA.
Engenharia de Prompt (Prompt Engineering)
Definição: A prática de projetar, testar e refinar as instruções textuais enviadas a uma LLM para obter respostas extremamente precisas, formatadas e contextualizadas de acordo com as necessidades do sistema.
Guardrails (Cercas de Segurança)
Definição: Regras programáticas ou filtros semânticos aplicados às entradas (inputs) e saídas (outputs) de uma IA para assegurar que ela opere dentro de limites éticos, legais e de marca estabelecidos.
Contexto: Impede que o assistente de IA use linguagem inadequada, exponha dados confidenciais ou faça promessas comerciais não autorizadas pelo Tenant.
Human-in-the-Loop (Humano no Circuito)
Definição: Abordagem de design de sistema onde a Inteligência Artificial auxilia no trabalho pesado, mas a tomada de decisão final ou a aprovação de uma ação crítica é obrigatoriamente delegada a um ser humano.
Contexto: No VendoraAI, os rascunhos de resposta gerados por RAG (Fase 3) e as ações dos Agentes de Triagem (Fase 4) exigem que o vendedor humano revise e clique em "Enviar" no WhatsApp, mantendo o controle total da relação comercial.
Extração Semântica (Semantic Extraction)
Definição: Capacidade de identificar e extrair informações estruturadas (como nomes, telefones, intenções de compra, agendamentos) a partir de blocos de conversas em texto corrido e informal.
Vetorização / Embeddings
Definição: O processo matemático de converter palavras, frases ou documentos inteiros em vetores numéricos de alta dimensão, que capturam o significado semântico dos textos de modo que sentenças com significados semelhantes fiquem geometricamente próximas uma das outras.
Banco de Dados Vetorial (Vector Database)
Definição: Banco de dados otimizado para armazenar e consultar vetores numéricos em alta velocidade, possibilitando buscas por similaridade semântica em vez de correspondência exata de palavras-chave.
Contexto: Essencial para a implementação rápida e barata do mecanismo de RAG.
4. Integrações e Conformidade
MCP (Model Context Protocol)
Definição: Protocolo aberto que padroniza como modelos de Inteligência Artificial se conectam a fontes de contexto de desenvolvimento (IDE, Repositórios Git, Bancos de Dados) permitindo que os agentes IA consumam dados técnicos de maneira unificada e estruturada.
WhatsApp Business Cloud API
Definição: API oficial mantida pela Meta que possibilita que médias e grandes empresas enviem e recebam mensagens do WhatsApp em larga escala de forma programática, segura e homologada.
Anonimização / Sanitização de Dados
Definição: Processo técnico de mascarar ou remover informações pessoais identificáveis (PII) — como CPFs, dados de cartões de crédito e senhas — de um histórico de mensagens. No VendoraAI, a sanitização é feita localmente (no backend) antes do envio do payload de dados para servidores externos de IA, protegendo a privacidade dos usuários em plena conformidade com a LGPD.