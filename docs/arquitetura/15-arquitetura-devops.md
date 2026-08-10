DevOps, Infraestrutura como Código (IaC) e CI/CD
Este documento estabelece as especificações de DevOps, Infraestrutura como Código (IaC) e Integração/Entrega Contínua (CI/CD) do VendoraAI. Ele reflete o compromisso com a Simplicidade Radical e a Custo-Eficiência, garantindo alta disponibilidade, ciclos rápidos de entrega e isolamento absoluto de ambientes para sustentar nossa operação SaaS voltada a PMEs.

🎯 1. Objetivos Estratégicos
Para garantir que a infraestrutura física acompanhe o crescimento estável da aplicação, adotamos quatro pilares fundamentais de operação:

Custo-Eficiência Extrema (FinOps): Redução dos custos fixos de nuvem para menos de $50/mês no ambiente de Staging e o menor custo inicial escalável em Produção, utilizando conteinerização leve e dimensionamento sob demanda.
Infraestrutura Determinística (IaC): Toda a infraestrutura na nuvem é provisionada estritamente via Terraform, impedindo configurações manuais e garantindo paridade absoluta de ambientes.
Segurança em Profundidade: Ausência completa de portas administrativas abertas ao tráfego público, controle rígido de redes isoladas (VPCs) e injeção automatizada de segredos em tempo de execução.
Entrega Contínua Sem Downtime: Pipelines automatizados de CI/CD baseados em GitHub Actions que validam e distribuem atualizações sem interrupção de serviço (Zero-Downtime Rolling Updates).
🌐 2. Estratégia de Ambientes
O ciclo de vida de desenvolvimento do VendoraAI opera sob três ambientes completamente isolados em nível de rede e dados:

[ Local (Dev) ] ──(Merge / PR)──> [ AWS Staging ] ──(Tag Release)──> [ AWS Production ]
  - Docker Compose                  - Fargate (Min)                   - Fargate (Auto-scaled)
  - Postgres Local                  - RDS Postgres (Micro)            - RDS Postgres (Multi-AZ)
  - Redis Local                     - ElastiCache (Micro)             - ElastiCache (Replicado)
A. Ambiente de Desenvolvimento (Local)
Hospedagem: Máquina local do desenvolvedor humana ou agente autônomo.
Mecanismo: Executado via docker-compose para garantir paridade exata de versões do PostgreSQL, Redis e Node.js.
Armazenamento: Simulado por meio de diretórios locais montados ou serviços compatíveis (ex: MinIO para emular o Cloudflare R2).
B. Ambiente de Staging (Homologação)
Hospedagem: Nuvem AWS (região us-east-1 por economia de custos).
Propósito: Validação final antes de subir a produção, execução de testes de integração e homologação de novos prompts de IA.
Configuração de Recursos:
AWS ECS Fargate: 1 Instância de Container (0.25 vCPU / 0.5 GB RAM).
AWS RDS PostgreSQL: Classe db.t4g.micro (Burstavel, Single-AZ) com Armazenamento SSD gp3.
AWS ElastiCache Redis: Classe cache.t4g.micro (Single-Node, sem replicação).
Custo Estreito: Otimizado com instâncias do tipo Spot e bancos de dados reduzidos para manter a sustentabilidade financeira do time de desenvolvimento.
C. Ambiente de Produção (Live)
Hospedagem: Nuvem AWS (região us-east-1 ou sa-east-1 dependendo da latência desejada).
Propósito: Entrega final de valor aos Tenants do VendoraAI.
Configuração de Recursos:
AWS ECS Fargate: Mínimo de 2 Instâncias (0.5 vCPU / 1 GB RAM) operando sob o escopo de um Application Load Balancer (ALB) com Auto Scaling configurado por uso de CPU (> 70%) ou conexões WebSocket ativas.
AWS RDS PostgreSQL: Classe db.t3.medium (Multi-AZ para alta disponibilidade) com replicação automática de volumes.
AWS ElastiCache Redis: Classe cache.t3.medium (configurado em cluster primário/réplica para resiliência de filas e rate limiting).
📦 3. Conteinerização (Docker)
Adotamos Docker Builds Multi-Stage para criar imagens de produção extremamente pequenas, baseadas na distribuição estável e enxuta do Alpine Linux. Isso reduz a superfície de ataque cibernético do sistema, otimiza o consumo de memória RAM do container e acelera o tempo de deploy em menos de 1 minuto.

A. Dockerfile do Backend Core (apps/api/Dockerfile)
# Stage 1: Build & Compilação
FROM node:20.11-alpine AS builder

WORKDIR /usr/src/app

# Copiar arquivos de dependências e bloqueios
COPY package*.json ./
COPY prisma ./prisma/

# Instalar dependências completas (incluindo devDependencies)
RUN npm ci

# Copiar código-fonte da aplicação
COPY . .

# Gerar o cliente transacional do Prisma ORM e buildar o código NestJS
RUN npx prisma generate
RUN npm run build

# Remover dependências de desenvolvimento para manter apenas pacotes de produção
RUN npm prune --production

# Stage 2: Imagem Final de Produção (Mínima)
FROM node:20.11-alpine AS runner

WORKDIR /usr/src/app

# Definir variáveis de ambiente para modo otimizado
ENV NODE_ENV=production
ENV PORT=3000

# Criar usuário de sistema não-privilegiado para evitar execução como ROOT (Segurança)
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nestjs -u 1001

# Copiar do Stage anterior apenas os arquivos compilados e os pacotes necessários
COPY --from=builder --chown=nestjs:nodejs /usr/src/app/dist ./dist
COPY --from=builder --chown=nestjs:nodejs /usr/src/app/node_modules ./node_modules
COPY --from=builder --chown=nestjs:nodejs /usr/src/app/package*.json ./
COPY --from=builder --chown=nestjs:nodejs /usr/src/app/prisma ./prisma

# Mudar para o usuário de menor privilégio
USER nestjs

EXPOSE 3000

# Executar a aplicação
CMD ["node", "dist/main.js"]
🏗️ 4. Infraestrutura como Código (IaC) - Terraform
Toda a infraestrutura AWS do VendoraAI é modelada de forma descritiva e declarativa utilizando o Terraform, versionada em diretório específico no Git (/infra/). O estado do Terraform (state) é armazenado em um bucket S3 com criptografia AES-256 e controle de concorrência por travas (locks) via DynamoDB, impedindo que múltiplos engenheiros modifiquem o ambiente ao mesmo tempo.

A. Estrutura de Arquivos Terraform
infra/
├── main.tf                 # Ponto de entrada, provedores e backend de estado
├── variables.tf            # Variáveis parametrizadas de ambiente (Staging vs Prod)
├── outputs.tf              # Outputs consolidados de conexões e domínios
├── modules/
│   ├── vpc/                # Rede isolada (Public Subnets, Private Subnets, NAT Gateways)
│   ├── database/           # PostgreSQL RDS, extensões pgvector e regras de segurança
│   ├── cache/              # AWS ElastiCache Redis e isolamento de grupos
│   └── compute/            # ECS Fargate, ALB, Task Definitions e Auto Scaling
└── environments/
    ├── staging.tfvars      # Parâmetros de infra de Staging (Recursos mínimos)
    └── production.tfvars   # Parâmetros de infra de Produção (Recursos escalados)
B. Definição Resumida de Recursos (Trecho infra/main.tf)
terraform {
  required_version = ">= 1.6.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
  backend "s3" {
    bucket         = "vendora-tfstate-storage"
    key            = "state/terraform.tfstate"
    region         = "us-east-1"
    dynamodb_table = "vendora-tflocks"
    encrypt        = true
  }
}

provider "aws" {
  region = var.aws_region
  default_tags {
    tags = {
      Project   = "VendoraAI"
      ManagedBy = "Terraform"
      Environment = var.environment
    }
  }
}

# Cluster de Contêineres ECS
resource "aws_ecs_cluster" "core_cluster" {
  name = "vendora-cluster-${var.environment}"

  setting {
    name  = "containerInsights"
    value = "enabled"
  }
}

# Banco de Dados PostgreSQL Relacional & Vetorial
resource "aws_db_instance" "postgres_db" {
  identifier             = "vendora-db-${var.environment}"
  allocated_storage      = 20
  max_allocated_storage  = 100
  storage_type           = "gp3"
  engine                 = "postgres"
  engine_version         = "16.1"
  instance_class         = var.db_instance_class
  db_name                = "vendora_${var.environment}"
  username               = var.db_username
  password               = var.db_password
  multi_az               = var.db_multi_az
  skip_final_snapshot    = var.environment == "staging" ? true : false
  vpc_security_group_ids = [aws_security_group.db_sg.id]
  db_subnet_group_name   = aws_db_subnet_group.db_subnets.name
}
🚀 5. Pipelines de CI/CD (GitHub Actions)
A automação de integração e entrega do VendoraAI utiliza GitHub Actions, dividida em duas esteiras integradas, ativadas por eventos de código no repositório.

[ Git Push / PR ] ──> [ Pipeline de CI ] ──(Sucesso)──> [ Pipeline de CD (Merge na main) ]
                        - Lint & Type Check             - Build & Push ECR (Docker)
                        - Testes Unitários              - Prisma Migrations (Task Run)
                        - Testes de Integração          - ECS Fargate Service (Rolling Deploy)
                                                        - Deploy Frontend Estático (Cloudflare Pages)
A. Esteira de Integração Contínua (CI) — .github/workflows/ci.yml
Gatilho: Qualquer commit empurrado para ramificações (push) ou abertura de Pull Requests.
Objetivo: Garantir a estabilidade e qualidade do código antes que ele seja incorporado aos ambientes comuns de hospedagem.
name: Continuous Integration (CI)

on:
  push:
    branches: [ develop, main ]
  pull_request:
    branches: [ develop, main ]

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout Código-Fonte
        uses: actions/checkout@v4

      - name: Configurar Node.js (Versão Estável)
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Instalar Dependências do Projeto
        run: npm ci

      - name: Validar Estilo de Código (Linter)
        run: npm run lint

      - name: Validar Tipagem Estrita (TypeScript Compile)
        run: npm run typecheck

      - name: Executar Testes Unitários (Jest)
        run: npm run test:unit

      - name: Executar Testes de Integração (Banco de Dados em Memória)
        run: npm run test:integration
B. Esteira de Entrega Contínua (CD) — .github/workflows/cd.yml
Gatilho: Fusão de código (merge) aceito com sucesso para a ramificação principal main.
Objetivo: Publicar atualizações de forma automática em Staging e Produção com testes regressivos integrados.
name: Continuous Deployment (CD)

on:
  push:
    branches: [ main ]

permissions:
  id-token: write
  contents: read

jobs:
  deploy-backend:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout Código-Fonte
        uses: actions/checkout@v4

      - name: Autenticar na Nuvem AWS (OpenID Connect - OIDC)
        uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: arn:aws:iam::123456789012:role/GithubActionsWorkflowDeploy
          aws-region: us-east-1

      - name: Autenticar no Amazon ECR (Registro de Imagens)
        id: login-ecr
        uses: aws-actions/amazon-ecr-login@v2

      - name: Configurar Docker Buildx (Cache Avançado)
        uses: docker/setup-buildx-action@v3

      - name: Buildar e Publicar Imagem Docker de Produção
        uses: docker/build-push-action@v5
        with:
          context: .
          file: ./apps/api/Dockerfile
          push: true
          tags: ${{ steps.login-ecr.outputs.registry }}/vendora-backend:latest
          cache-from: type=gha
          cache-to: type=gha,mode=max

      - name: Rodar Prisma Migrations de Forma Segura (Task Isolada no ECS)
        run: |
          aws ecs run-task \
            --cluster vendora-cluster-production \
            --task-definition vendora-migration-runner-production \
            --launch-type FARGATE \
            --network-configuration "awsvpcConfiguration={subnets=[subnet-12345],securityGroups=[sg-12345],assignPublicIp=ENABLED}"

      - name: Executar Rolling Update no AWS ECS Fargate
        run: |
          aws ecs update-service \
            --cluster vendora-cluster-production \
            --service vendora-api-service-production \
            --force-new-deployment

  deploy-frontend:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout Código-Fonte
        uses: actions/checkout@v4

      - name: Configurar Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Instalar Dependências e Compilar SPA
        run: |
          npm ci
          npm run build:frontend
        env:
          VITE_API_BASE_URL: https://api.vendora.ai

      - name: Deploy de Assets Estáticos para CDN (Cloudflare Pages)
        uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          command: pages deploy dist/frontend --project-name=vendora-app
🔒 6. Gerenciamento Seguro de Configurações e Segredos
A arquitetura do VendoraAI adota uma postura estrita contra vazamentos acidentais de credenciais. Nenhuma chave de API, senha de banco de dados ou certificado criptográfico é salvo no código-fonte.

A. Fluxo de Injeção de Segredos
Armazenamento Isolado: Os segredos reais são cadastrados de forma restrita e encriptada no AWS Secrets Manager (ambiente backend) ou nas chaves protegidas de variáveis de repositório (GitHub Secrets).
Injeção em Tempo de Execução (Runtime): Durante a inicialização do container ECS Fargate, a Task Execution Role (regra de execução de tarefas do IAM da AWS) lê os valores criptografados diretamente do Secrets Manager e os injeta de forma volátil na memória RAM do processo Node.js como variáveis de ambiente nativas.
Acesso Restrito: Os desenvolvedores não possuem as senhas reais de produção. Eles utilizam chaves geradas em suas instâncias de desenvolvimento locais.
💾 7. Política de Backups, Recuperação e Resiliência (Disaster Recovery)
Para manter a conformidade com as regras de resiliência e integridade de dados comerciais das PMEs (SLA e Disponibilidade), implementamos regras de recuperação de catástrofes:

[ Evento Crítico / Falha Geral ] ──> [ Ativação de Protocolos ] ──> [ Restauração em < 4h ]
                                       - RDS Point-in-Time               - RPO: Perda Max < 24h
                                       - Terraform Redeploy              - RTO: Recuperação Max < 4h
                                       - Cloudflare Failover             - Backups Criptografados
PostgreSQL (RDS) Backups Automatizados:
Sistemas de backup diários automáticos com retenção de 7 dias para homologação (Staging) e 30 dias para produção (Production).
Point-in-Time Recovery (PITR): Habilitado para produção, permitindo restaurar o estado do banco de dados em qualquer segundo específico de tempo dos últimos 30 dias caso ocorra um erro de operação humana ou script destrutivo.
Redis (ElastiCache):
Sendo um banco de cache volátil de tráfego rápido, ele não armazena dados de persistência mútua. Em caso de desastre ou parada inesperada, o Redis é provisionado vazio via Terraform e o sistema volta a funcionar sob a estratégia de degradação graciosa com consultas diretas ao banco relacional até o reaquecimento automático de chaves.
Cloudflare R2 Object Storage:
Configuração nativa de exclusão permanente de mídias de mais de 30 dias para atender ao expurgo físico da LGPD (RN-PRIV-02), com replicação de leitura síncrona no modelo geográfica/cross-region do próprio provedor para evitar perda física de imagens ou comprovantes antes do limite temporal da regra.
Objetivos de SLA (RTO & RPO):
Recovery Point Objective (RPO): Máximo de 24 horas de perda aceitável de dados em caso de falha catastrófica geral de infraestrutura física.
Recovery Time Objective (RTO): Tempo máximo de 4 horas para reconstrução total e restabelecimento completo do ecossistema de serviços a partir do acionamento dos scripts do Terraform e restauração de backups.