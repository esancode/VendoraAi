Arquitetura do Frontend — VendoraAI
Este documento estabelece as diretrizes de engenharia, os padrões de desenvolvimento e a organização de código para a interface de usuário (UI/UX) do VendoraAI. Ele serve como a fonte de verdade para desenvolvedores e agentes autônomos garantirem consistência visual, performance de carregamento e real-time responsivo em dispositivos móveis e desktop.

1. Visão Geral e Filosofia (Simplicidade Radical)
Seguindo o princípio de Simplicidade Radical estabelecido na visão de produto (docs/00-visao-geral.md), o frontend do VendoraAI afasta-se de dashboards tradicionais repletos de gráficos de pizza densos e tabelas analíticas complexas. A interface é projetada sob o conceito de UX Narrativo, priorizando:

Leitura Rápida: Cards contextuais em formato de texto estruturado e natural que informam imediatamente ao dono da PME onde estão os gargalos (ex: "Sua equipe perdeu 3 vendas hoje por lentidão no tempo de resposta superior a 15 minutos").
Mobile-First Real: Como os donos e gerentes de pequenas empresas gerenciam seus negócios em movimento, 100% das telas devem ser otimizadas para uso em smartphones com touch inputs confortáveis.
Custo-Eficiência de Infraestrutura: O frontend é gerado como uma Single Page Application (SPA) 100% estática, permitindo hospedagem de custo zero ou desprezível em redes de distribuição de conteúdo (CDNs) como Cloudflare Pages ou Vercel, eliminando a sobrecarga e custos de servidores Node para Server-Side Rendering (SSR).
2. Stack Tecnológica do Frontend
A stack de tecnologia foi definida em conformidade com o documento de infraestrutura (docs/arquitetura/02-stack-tecnologica.md):

Runtime & Build Engine: Vite + TypeScript (Garante builds ultra-rápidos e tipagem estrita de contratos de API).
Biblioteca Base: React 18+ (Abordagem baseada em componentes funcionais e hooks customizados).
Estilização: Tailwind CSS (Utilidade prioritária para garantir CSS enxuto, responsividade integrada e eliminação de CSS inútil via Purge no build).
Componentes de UI Básicos: Radix UI Primitives (Componentes sem estilo para garantir acessibilidade integral - WAI-ARIA) combinados com Lucide React para ícones.
Gerenciamento de Estado de Servidor: TanStack Query v5 (React Query) (Responsável por cacheamento inteligente de requisições HTTP, paginação automática, invalidação de estados e reconexões transparentes).
Comunicação em Tempo Real: Socket.io-client (Canal bidirecional persistente via WebSockets para recebimento de alertas imediatos de SLA e novas mensagens sem necessidade de polling).
3. Estrutura de Diretórios (src/)
O projeto utiliza uma estrutura modular híbrida baseada em Features, facilitando o isolamento de escopo e permitindo o desenvolvimento concorrente de funcionalidades sem conflitos de merge.

src/
├── assets/                    # Imagens, logotipos e fontes globais
├── components/                # Componentes globais reutilizáveis (Botões, Inputs, Cards genéricos)
│   ├── ui/                    # Componentes atômicos e acessíveis baseados em Radix + Tailwind
│   └── feedback/              # Modais de carregamento, esqueletos (skeletons) e alertas de erro
├── config/                    # Variáveis de ambiente, constantes globais e clientes de API
├── context/                   # Contextos nativos do React (Autenticação, Tema, Sockets globais)
├── features/                  # Módulos isolados por contexto de domínio (conforme Bounded Contexts)
│   ├── auth/                  # Login, onboarding de Tenant e recuperação de conta
│   ├── dashboard/             # Tela principal de insights narrativos de vendas e perdas
│   ├── leads/                 # Lista de contatos, detalhes do lead e timeline comercial
│   ├── chat-simulator/        # Simulador/Visualizador de chats higienizados e rascunhos com IA
│   └── settings/              # Configurações de expediente do Tenant, regras de SLA e perfil
│       ├── components/        # Componentes privados desta feature
│       ├── hooks/             # Hooks específicos desta feature (ex: useSlaSettings)
│       ├── services/          # Chamadas de API exclusivas da feature
│       └── index.ts           # Ponto de entrada público do módulo
├── hooks/                     # Custom hooks globais de utilidade (useDebounce, useMediaQuery)
├── routes/                    # Configuração de rotas declarativas (React Router) e Guards de Acesso
├── services/                  # Clientes de API HTTP (Axios) e interceptores globais de erro
├── types/                     # Tipagens TypeScript compartilhadas e contratos de DTOs do Backend
├── utils/                     # Funções utilitárias puras (Formatação de moeda, manipulação de datas)
├── App.tsx                    # Componente raiz
└── main.tsx                   # Inicializador do React
4. Gerenciamento de Estado e Ciclo de Dados
Para manter o frontend leve e reativo, dividimos o gerenciamento de estado em três pilares claros:

A. Estado de Servidor (Server State) — TanStack Query
Toda informação vinda do banco de dados (através do Backend) é gerenciada, cacheada e atualizada pelo React Query.

Políticas de Cache (Stale Time):
Listagens gerais (como histórico de leads frios): staleTime: 10 * 1000 (10 segundos).
Configurações do Tenant (expediente, regras de SLA): staleTime: 5 * 60 * 1000 (5 minutos, pois raramente mudam).
Invalidação Ativa: Quando uma mutação (ex: atualizar o status de um lead) é enviada via POST/PUT, a chave de query correspondente é invalidada imediatamente para forçar um refetch em background.
B. Estado de Tempo Real (Real-time State) — WebSockets
Para cumprir a regra de tempo de resposta instantâneo, o frontend mantém uma conexão persistente via Socket.io.

Ao receber o evento webhook.whatsapp.received ou lead.sla.cooling do backend, o hook useSocketEvents intercepta a mensagem e dispara:
Uma notificação toast visual em tela.
A invalidação local (queryClient.invalidateQueries) de queries críticas (ex: ['dashboard-insights']), forçando uma atualização transparente dos dados sem recarregar a página.
C. Estado de UI (Local State) — Context & Native Hooks
Estados locais de interface (modais abertos, menus de navegação móvel recolhidos, filtros temporários) são mantidos estritamente em hooks useState no nível mais baixo do componente para evitar renderizações desnecessárias.
Dados que afetam toda a sessão (como dados do usuário logado e instância de conexão ativa de WebSocket) são injetados via React Context (AuthContext e SocketContext).
5. Fluxos de UI, Responsividade e Acessibilidade
A. O Grid de Simplicidade Radical (Dashboard)
A tela de entrada do usuário logado é dividida em três contêineres narrativos lógicos:

O Diagnóstico do Dia: Bloco superior em formato de texto corrido e amigável (ex: "Olá, João. Seu SLA médio hoje está em 8 minutos. Excelente! Mas preste atenção: existem 3 leads aguardando resposta há mais de 1 hora").
A Lista de Prioridades (Foco de Ação): Cards simples ordenados pelo nível de urgência do SLA útil. Cada card exibe o nome do lead, o tempo restante antes de esfriar e o vendedor responsável.
O Painel de Perda Semântica: Sumário das últimas 24 horas evidenciando o principal motivo semântico de perda de conversão (ex: "82% das perdas recentes foram por objeções de Preço. Considere revisar sua oferta mínima").
B. Mobile-First e Layout Adaptativo
Breakpoints Padrão: Uso estrito das classes utilitárias do Tailwind CSS baseadas no padrão sm: (640px), md: (768px), lg: (1024px).
Touch Targets: Todos os elementos interativos (botões, links de navegação, abas de filtro) devem possuir uma área clicável de no mínimo 44px x 44px para evitar toques acidentais em dispositivos móveis.
Navegação Inteligente: Em telas mobile, a barra lateral de navegação (Sidebar) é substituída por uma barra de navegação inferior (Bottom Tab Bar) contendo os links rápidos (Início, Leads, Configurações).
C. Temporizadores Visuais e SLA Útil (RN-SLA)
O frontend deve calcular e exibir temporizadores progressivos em tempo real nos cards de leads.

O backend envia o timestamp limite do SLA (slaExpirationLimit).
O frontend roda um temporizador local (setInterval de 1 segundo) que calcula a diferença entre a hora atual do dispositivo e o limite restante.
Indicadores de Temperatura Visuais:
Verde (SLA Saudável): Mais de 50% do tempo de resposta útil restante.
Laranja (Lead Esfriando): Menos de 50% ou menos de 30 minutos restantes (Gatilha alerta sonoro de baixa prioridade).
Vermelho (SLA Estourado): SLA útil esgotado.
6. Segurança e Performance
A. Autenticação e Armazenamento Seguros
JWT Transiente: O Access Token enviado pelo backend é mantido exclusivamente em memória ram do aplicativo (dentro do estado do AuthContext).
Refresh Token: O fluxo de refresh de token é automatizado via cookie HTTP-Only gerido pelo backend Fastify para evitar ataques de Cross-Site Scripting (XSS).
Higienização na UI: O frontend nunca exibe dados brutos mascarados de cartões de crédito ou documentos completos de clientes. Toda e qualquer informação visualizada em tela deve vir higienizada do backend.
B. Otimização e Performance do Build (Vite)
Route-Based Code Splitting: Uso de React.lazy e Suspense nas principais rotas da aplicação para garantir que o bundle inicial do React seja inferior a 150kb (Gzipped).
Otimização de Assets: Todo ícone deve ser carregado sob demanda (via Lucide React modules individuais) para evitar inclusão de pacotes de ícones inteiros no build de produção.
Configuração de Cache de Headers (CDN): Como a SPA é estática, o build de produção no Vite inclui hashes nos nomes dos arquivos gerados (ex: index-a98fbc.js). As regras da CDN de deploy devem marcar os arquivos em /assets/* como cache permanente (Cache-Control: public, max-age=31536000, immutable), reduzindo o tempo de carregamento em visitas recorrentes a menos de 300ms.
7. Rastreabilidade com Requisitos e Regras de Negócio
Para garantir a coerência sistêmica, mapeamos abaixo como o Frontend implementa e sustenta os contratos de engenharia do VendoraAI:

Tela / Módulo Frontend	Requisito Funcional Implementado	Regra de Negócio Associada	Estratégia de Implementação
Painel de Insights	RF-03, RF-04	RN-SEM-01, RN-SEM-02	Renderização narrativa limpa alimentada por cache otimizado do React Query.
Card de Lead Único	RF-05, RF-06	RN-SLA-01, RN-SLA-02	Temporizador regressivo local sincronizado com fuso horário e regras de expediente.
Simulador de Respostas	RF-07, RF-08	RN-PRIV-01, RN-COB-02	Exibição de rascunhos de IA gerados em pipeline seguro e cálculo de limites.
Configurações de SLA	RF-02	RN-SLA-03	Formulário dinâmico de horários de expediente com validações robustas em React Hook Form.