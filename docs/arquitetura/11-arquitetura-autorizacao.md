Arquitetura de Autorização (RBAC & ABAC)
Este documento especifica a arquitetura de controle de acesso do VendoraAI. Ele define como o sistema garante que apenas usuários e agentes autorizados executem operações específicas dentro do escopo de seus respectivos locatários (Tenants). A estratégia combina o Controle de Acesso Baseado em Papéis (RBAC) para segmentação de funções administrativas e operacionais com o Controle de Acesso Baseado em Atributos (ABAC) para políticas finas de propriedade e ciclo de vida de dados (por exemplo, um vendedor acessando apenas seus próprios leads).

1. Visão Geral da Estrutura de Autorização
O modelo de segurança do VendoraAI opera em um design de defesa em profundidade estruturado em três camadas independentes:

[ REQUISIÇÃO HTTP / WS ]
         │
         ▼
┌─────────────────────────────────┐
│     1. Camada de Gateway        │ ──► Rate Limiting & Validação de JWT
└─────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│     2. Camada de Aplicação      │ ──► NestJS Guards (RBAC) & CASL Engine (ABAC)
└─────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│   3. Camada de Persistência     │ ──► PostgreSQL Row-Level Security (RLS) por Tenant
└─────────────────────────────────┘
Camada de Isolamento de Tenant (Banco de Dados/RLS): Garante que, independentemente da permissão do usuário, ele nunca possa ler ou escrever dados pertencentes a outro locatário (Tenant). É a barreira matemática intransponível governada pelo PostgreSQL RLS.
Camada de Papéis Funcionais (RBAC): Define permissões estáticas com base no papel do usuário dentro da organização do Tenant (ex: ADMIN, VENDEDOR).
Camada de Atributos Dinâmicos (ABAC): Executa avaliações contextuais e em tempo de execução das propriedades do recurso (ex: validar se o vendedor que tenta responder a um lead é, de fato, o atual proprietário/responsável por aquele lead).
2. Controle de Acesso Baseado em Papéis (RBAC)
O VendoraAI adota uma taxonomia simplificada de papéis (Roles) para garantir facilidade de uso em PMEs, minimizando o atrito operacional de configuração.

2.1 Papéis e Permissões Mapeadas
Função (Role)	Descrição	Escopo de Acesso	Operações Permitidas
OWNER	Dono da conta do Tenant (Criador)	Todo o Tenant	Todas as operações, incluindo exclusão do Tenant, alteração de dados de faturamento e exclusão de logs de auditoria.
ADMIN	Administrador de vendas/gerente	Todo o Tenant	Gerenciamento de usuários (convites/bloqueios), alteração de integrações (WhatsApp Business API), parametrização de regras de SLA e motivos de perda. Não pode deletar o Tenant.
VENDEDOR	Operador comercial final	Apenas os próprios recursos	Visualização e resposta de leads associados a si, visualização de suas próprias métricas de performance e SLA. Não altera configurações globais.
SYSTEM_AGENT	Agente autônomo de IA ou Worker	Escopo delimitado por tarefa	Ingestão de mensagens brutas, geração de resumos, geração de embeddings e atualização de métricas estatísticas agregadas.
2.2 Estrutura do Enum de Papéis (TypeScript)
No backend, os papéis são modelados de forma estrita no arquivo @domain/enums/role.enum.ts:

export enum UserRole {
  OWNER = 'OWNER',
  ADMIN = 'ADMIN',
  VENDEDOR = 'VENDEDOR',
  SYSTEM_AGENT = 'SYSTEM_AGENT'
}
3. Controle de Acesso Baseado em Atributos (ABAC)
O RBAC puro falha ao tentar resolver regras dinâmicas, como: "Um Vendedor só pode alterar o status de um Lead se for o proprietário atual deste lead". Para sanar isso de forma desacoplada e limpa, o VendoraAI integra a biblioteca CASL (casl.js) no pipeline do NestJS.

3.1 Entidades e Suas Regras Contextuais (ABAC)
As regras contextuais são avaliadas com base no estado atual da entidade recuperada do banco de dados antes da execução do caso de uso.

import { AbilityBuilder, PureAbility } from '@casl/ability';

export type Action = 'create' | 'read' | 'update' | 'delete' | 'manage';
export type Subjects = 'Tenant' | 'User' | 'Lead' | 'Conversation' | 'BillingRule' | 'all';

export type AppAbility = PureAbility<[Action, Subjects]>;

export function defineAbilitiesFor(user: { id: string; role: UserRole; tenantId: string }) {
  const { can, cannot, build } = new AbilityBuilder<AppAbility>(PureAbility);

  if (user.role === UserRole.OWNER) {
    can('manage', 'all'); // Controle absoluto do tenant
  }

  if (user.role === UserRole.ADMIN) {
    can('manage', 'all');
    cannot('delete', 'Tenant'); // Não pode apagar a empresa do mapa
    cannot('manage', 'BillingRule'); // Regras de faturamento são restritas ao OWNER
  }

  if (user.role === UserRole.VENDEDOR) {
    // Permissões de Usuário
    can('read', 'User', { id: user.id });
    can('update', 'User', { id: user.id });

    // Permissões de Leads (ABAC Dinâmico)
    can('read', 'Lead', { assignedUserId: user.id });
    can('update', 'Lead', { assignedUserId: user.id });
    cannot('delete', 'Lead'); // Vendedores nunca deletam leads físicos

    // Permissões de Conversas e Mensagens
    can('read', 'Conversation', { lead: { assignedUserId: user.id } });
    can('create', 'Conversation', { lead: { assignedUserId: user.id } });
  }

  if (user.role === UserRole.SYSTEM_AGENT) {
    can('read', 'all');
    can('create', 'Conversation');
    can('update', 'Lead'); // Para atualizar o SLA de resposta e classificação de perda
  }

  return build();
}
4. Implementação no NestJS (Guards e Interceptors)
A validação de autorização ocorre de maneira declarativa utilizando decoradores personalizados sobre as rotas dos controllers.

4.1 Decorador de Permissões (@CheckPolicies)
Criamos um decorador unificado que combina a verificação do RBAC e ABAC:

// @infrastructure/security/decorators/check-policies.decorator.ts
import { SetMetadata } from '@nestjs/common';
import { Action, Subjects } from './ability.factory';

export interface RequiredPolicy {
  action: Action;
  subject: Subjects;
}

export const CHECK_POLICIES_KEY = 'check_policies';
export const CheckPolicies = (...requirements: RequiredPolicy[]) =>
  SetMetadata(CHECK_POLICIES_KEY, requirements);
4.2 O Guardião de Políticas (PoliciesGuard)
O PoliciesGuard intercepta a chamada, extrai o usuário autenticado do contexto (injetado anteriormente pelo JwtAuthGuard), monta a matriz de habilidades (Abilities) e avalia cada regra contra os parâmetros da requisição (como o :id do lead vindo da URL).

// @infrastructure/security/guards/policies.guard.ts
import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { CaslAbilityFactory } from '../factories/casl-ability.factory';
import { CHECK_POLICIES_KEY, RequiredPolicy } from '../decorators/check-policies.decorator';

@Injectable()
export class PoliciesGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private caslAbilityFactory: CaslAbilityFactory,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const policyRequirements =
      this.reflector.get<RequiredPolicy[]>(CHECK_POLICIES_KEY, context.getHandler()) || [];

    const request = context.switchToHttp().getRequest();
    const user = request.user; // Injetado pelo JwtAuthGuard

    if (!user) {
      throw new ForbiddenException('Usuário não autenticado no contexto.');
    }

    const ability = this.caslAbilityFactory.createForUser(user);

    // Validação estática das políticas associadas à rota
    const isAllowed = policyRequirements.every((policy) =>
      ability.can(policy.action, policy.subject)
    );

    if (!isAllowed) {
      throw new ForbiddenException('Acesso negado: privilégios insuficientes.');
    }

    return true;
  }
}
4.3 Exemplo de Controller Protegido
Abaixo está o exemplo prático do LeadController demonstrando o uso combinado das camadas de autenticação, verificação de políticas de acesso e injeção do contexto do Tenant:

// @infrastructure/controllers/lead.controller.ts
import { Controller, Get, Patch, Param, Body, UseGuards, Req } from '@nestjs/common';
import { JwtAuthGuard } from '../security/guards/jwt-auth.guard';
import { PoliciesGuard } from '../security/guards/policies.guard';
import { CheckPolicies } from '../security/decorators/check-policies.decorator';
import { UpdateLeadDto } from '@application/dtos/update-lead.dto';
import { UpdateLeadUseCase } from '@application/use-cases/update-lead.usecase';

@Controller('leads')
@UseGuards(JwtAuthGuard, PoliciesGuard)
export class LeadController {
  constructor(private readonly updateLeadUseCase: UpdateLeadUseCase) {}

  @Patch(':id')
  @CheckPolicies({ action: 'update', subject: 'Lead' })
  async update(
    @Param('id') id: string,
    @Body() updateLeadDto: UpdateLeadDto,
    @Req() req: any
  ) {
    const user = req.user;

    // O UseCase se encarregará de buscar o Lead e aplicar as regras ABAC do CASL
    // Além disso, o tenant_id injetado no escopo do Prisma previne acessos fora do Tenant
    return this.updateLeadUseCase.execute({
      leadId: id,
      userId: user.id,
      userRole: user.role,
      tenantId: user.tenantId,
      data: updateLeadDto
    });
  }
}
5. Auditoria de Falhas de Autorização (Logs de Segurança)
Tentativas de quebra de barreira de acesso de segurança não são apenas erros de navegação: são potenciais vetores de ataque. Portanto, o sistema intercepta exceções do tipo ForbiddenException e gera logs de auditoria centralizados em um formato estruturado que pode ser processado por ferramentas de SIEM.

5.1 Estrutura do Log de Erro de Autorização (JSON)
Sempre que uma falha de autorização ocorre, o interceptor do NestJS grava um log estruturado utilizando o Winston:

{
  "timestamp": "2026-08-07T15:21:31.000Z",
  "level": "warn",
  "category": "SECURITY_AUTHORIZATION_FAILURE",
  "tenantId": "tenant_prod_abc123",
  "userId": "user_seller_009",
  "userRole": "VENDEDOR",
  "ip": "189.123.45.67",
  "userAgent": "Mozilla/5.0...",
  "requestPath": "/api/v1/leads/lead_admin_secrets_999",
  "httpMethod": "PATCH",
  "policyRequired": {
    "action": "update",
    "subject": "Lead"
  },
  "failureReason": "ABAC_PROPERTY_MISMATCH",
  "context": {
    "assignedUserId": "user_admin_001",
    "requestedLeadId": "lead_admin_secrets_999"
  }
}
Estes logs são rotulados com tags de severidade alta e despachados para filas secundárias, permitindo o acionamento de bloqueios de IPs temporários caso um usuário ou bot tente disparar requisições em série a IDs fora de seu escopo (IDOR - Insecure Direct Object Reference).