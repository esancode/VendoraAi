10. Arquitetura de Autenticação
Este documento especifica os mecanismos de segurança e os protocolos de identidade que gerenciam o acesso de usuários humanos ao ecossistema VendoraAI. Sob o princípio de Simplicidade Radical e segurança estrita de um ambiente SaaS Multi-Tenant, a arquitetura implementa um modelo híbrido de autenticação composto por tokens JWT stateless de curta duração e sessões de persistência stateful via Redis.

1. Objetivos de Segurança
Garantia de Isolamento Multi-Tenant: Certificar que nenhuma transação de autenticação possa inadvertidamente associar um usuário ao tenant incorreto, mantendo compatibilidade com as regras de Row-Level Security (RLS) do banco de dados.
Mitigação de Ataques de Sessão: Implementar barreiras robustas contra ataques de Cross-Site Scripting (XSS) e Cross-Site Request Forgery (CSRF).
Alto Desempenho na Validação: Minimizar consultas repetitivas de leitura no banco de dados relacional (PostgreSQL) a cada requisição de API HTTP, utilizando verificações criptográficas locais e cache distribuído em memória (Redis).
Proteção de Credenciais: Garantir que as senhas dos usuários locais sejam processadas e armazenadas com o estado da arte em algoritmos de hash criptográficos.
2. Estratégia de Sessão e Tokens (Modelo Híbrido)
O VendoraAI adota uma estratégia híbrida de controle de identidade: as chamadas de rotas de API protegidas são autenticadas via JSON Web Tokens (JWT) Stateless, enquanto o gerenciamento do ciclo de vida das sessões e revogações é tratado de forma Stateful através de Refresh Tokens persistidos temporariamente no Redis.

┌─────────────────────────────────────────────────────────────────────────┐
│                          FLUXO DE SEGURANÇA                             │
│                                                                         │
│  [ React SPA ] ──( 1. HTTP-Only Cookie: Refresh Token )──> [ Fastify ]  │
│        │                                                      │         │
│   (Memória RAM)                                          (Valida JWT)   │
│        │                                                      │         │
│        ▼                                                      ▼         │
│  [ Access Token ] ──( 2. Auth Bearer Header: JWT )───────> [ Redis ]    │
│                                                          (Verifica se   │
│                                                           está banido)  │
└─────────────────────────────────────────────────────────────────────────┘
A. Access Token (JWT - Stateless)
Finalidade: Autorizar requisições do frontend às rotas protegidas do backend.
Ciclo de Vida: Curto (15 minutos).
Assinatura: Algoritmo simétrico HS256 utilizando um segredo de alta entropia rotacionado periodicamente via variáveis de ambiente da nuvem, ou opcionalmente RS256 (par de chaves pública/privada) em cenários de federação futura.
Payload Mínimo Obrigatório:
{
  "iss": "vendora.ai",
  "sub": "usr_01J4R5V59W9Z982A1B3C4D5E6F",
  "tenant_id": "ten_01J4R5V59W9Z982A1B3C4D5000",
  "name": "Carlos Silva",
  "role": "VENDEDOR",
  "iat": 1786111200,
  "exp": 1786112100
}
B. Refresh Token (Stateful)
Finalidade: Solicitar a emissão de um novo Access Token válido sem exigir que o usuário informe as suas credenciais novamente.
Ciclo de Vida: Longo (7 dias).
Armazenamento no Backend: Persistido no Redis (DB 0) sob a chave formatada tenant:{tenant_id}:session:{user_id}:{token_hash} para garantir compatibilidade com Redis Clusters. O valor armazenado em cache contém metadados sobre o dispositivo do usuário (User-Agent e IP) e a expiração física.
Rotação de Refresh Tokens (RTR - Refresh Token Rotation): A cada requisição de renovação de sessão, o Refresh Token utilizado é invalidado permanentemente e um novo par de tokens (Access + Refresh) é enviado para o cliente. Se um token já consumido for apresentado novamente, o sistema assume que ocorreu uma tentativa de roubo de sessão e revoga imediatamente todas as sessões ativas do usuário associado.
3. Armazenamento e Transporte de Segurança
Para blindar a aplicação contra ataques que tentam extrair tokens do ambiente do navegador, o transporte e o armazenamento físico dos identificadores de sessão seguem regras estritas baseadas na superfície de ataque:

Tipo de Token	Armazenamento no Cliente (SPA)	Canal de Transporte HTTP	Propriedades do Transporte	Superfície Protegida
Access Token	Memória RAM (Estado interno do React)	Cabeçalho Authorization: Bearer <token>	Criptografado por HTTPS (TLS 1.3)	Mitiga XSS (não é persistido em LocalStorage ou Cookies legíveis)
Refresh Token	Cookie de Navegador	Cabeçalho Cookie: refresh_token=<token_hash>	HttpOnly, Secure, SameSite=Strict, Path=/api/v1/auth/refresh	Mitiga XSS e CSRF (inacessível para scripts e restrito ao domínio de origem)
4. Hash e Segurança de Senhas (Local Auth)
Para o cadastro e validação de usuários que utilizam autenticação direta por e-mail e senha, o VendoraAI proíbe o uso de algoritmos obsoletos (como MD5, SHA-1 ou SHA-256 bruto) e padroniza o Argon2id (perfil recomendado pela OWASP) como criptografia forte de hashes de senha.

Parâmetros de Configuração do Argon2id (OWASP Recomendado)
Memória (m): 65536 KB (64 MB de alocação de RAM por hash).
Tempo/Iterações (t): 3 ciclos de iteração.
Paralelismo (p): 4 threads paralelas.
Tamanho do Salt: 16 bytes gerados via gerador pseudoaleatório criptograficamente seguro (CSPRNG).
Tamanho de Saída (Hash): 32 bytes.
Exemplo de Fluxo de Comparação de Senhas (NestJS Service)
import * as argon2 from 'argon2';

@Injectable()
export class PasswordHasherService implements PasswordHasherPort {
  async hash(password: string): Promise<string> {
    return argon2.hash(password, {
      type: argon2.argon2id,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 4,
      saltLength: 16,
    });
  }

  async compare(hash: string, password_raw: string): Promise<boolean> {
    return argon2.verify(hash, password_raw);
  }
}
5. Injeção de Contexto Multi-Tenant
Para garantir que a barreira do Multi-Tenancy seja respeitada desde o início do ciclo de vida de uma requisição, o middleware de autenticação intercepta as chamadas de API, decodifica o JWT e preenche a estrutura de contexto antes que o controle alcance as regras de negócio ou de banco.

[ Requisição HTTP ]
        │
        ▼ (Fastify Middleware)
┌────────────────────────────────────────────────────────┐
│ Decodifica e valida assinatura do JWT                 │
│ Extrai tenant_id, user_id e roles                      │
└────────────────────────────────────────────────────────┘
        │
        ▼ (Injeta contexto de Tenant)
┌────────────────────────────────────────────────────────┐
│ request.tenantContext = {                              │
│   tenantId: 'ten_01J4R5V59W9Z982A1B3C4D5000',          │
│   userId: 'usr_01J4R5V59W9Z982A1B3C4D5E6F',            │
│   role: 'VENDEDOR'                                     │
│ }                                                      │
└────────────────────────────────────────────────────────┘
        │
        ▼ (Prisma Interceptor / Transaction)
┌────────────────────────────────────────────────────────┐
│ Executa query aplicando a variável de sessão do Postgres:│
│ SET LOCAL app.current_tenant_id = tenantContext.tenantId;│
│ (Ativa o Row-Level Security no PostgreSQL)             │
└────────────────────────────────────────────────────────┘
6. Fluxos de Autenticação
Fluxo de Login por Credenciais
O usuário submete e-mail e senha pelo React SPA via canal HTTPS seguro.
O API Gateway do Fastify encaminha o payload ao módulo AuthModule.
O serviço de autenticação busca as credenciais cifradas na tabela User baseada no e-mail (usando indexação otimizada).
O Argon2id valida a senha submetida contra o hash armazenado.
Se válidos, o sistema gera o ID de sessão, registra o hash do Refresh Token no Redis (com TTL de 7 dias) e emite os dois tokens.
O backend escreve o Refresh Token no Cookie da resposta com as diretivas HTTP-Only e retorna o Access Token no corpo em formato JSON para o React SPA salvar na memória RAM de forma volátil.
Fluxo de Renovação de Sessão (Refresh Session)
O React SPA detecta via interceptor do HTTP Client (Axios/Fetch) que o Access Token expirou ou está prestes a expirar.
O SPA efetua uma chamada POST para /api/v1/auth/refresh. O navegador inclui automaticamente o cookie contendo o Refresh Token.
O middleware lê o Cookie e valida o hash contra o Redis (DB 0).
Verificação de Abuso (RTR):
Caso 1 (Token Válido): O backend invalida o Refresh Token usado, remove a entrada antiga do Redis, cria um novo Refresh Token no Redis, seta o novo cookie no cabeçalho e envia o novo Access Token em formato JSON.
Caso 2 (Token Reutilizado/Revogado): O backend assume que a sessão foi interceptada. Ele limpa todas as sessões registradas no Redis sob a chave tenant:{tenant_id}:session:{user_id}:*, limpa o cookie do navegador do usuário infrator e retorna erro HTTP 401 Unauthorized com código semântico SESSION_REVOKED.
7. Políticas de Resiliência e Prevenção de Ataques
A. Rate Limiting de Autenticação (Brute Force Protection)
Para proteger o endpoint de login contra ataques de força bruta, a arquitetura implementa uma barreira temporizada em memória usando o Redis no banco de dados isolado DB 2 (reservado para controle de tráfego):

Célula de Bloqueio: Máximo de 5 tentativas de login incorretas por par de (IP + E-mail) dentro de uma janela deslizante de 15 minutos.
Penalidade: Caso o limite seja atingido, a rota de login bloqueia requisições adicionais com o status HTTP 429 Too Many Requests, devolvendo cabeçalhos informativos de Retry-After que são validados no frontend.
B. Bloqueio Temporário de Conta
Se o número de tentativas inválidas para uma mesma conta de e-mail alcançar 10 falhas em qualquer período de tempo de forma persistente, o status do usuário na tabela User é automaticamente atualizado para LOCKED por um período de 30 minutos.
Um e-mail de alerta de segurança é enviado à caixa de entrada do usuário avisando sobre o bloqueio e provendo instruções seguras de recuperação.
C. Blacklist de Tokens
Em caso de encerramento proativo de sessão (Logout) ou exclusão de um usuário, o ID de sessão e o respectivo Access Token associado têm suas informações propagadas via Redis Pub/Sub.
Se for necessário realizar o bloqueio imediato antes do vencimento natural do JWT de 15 minutos, o ID do token (jti) é salvo em uma Blacklist de curta duração no Redis (TTL igual ao tempo restante de validade do token). O middleware de autenticação intercepta as chamadas e valida o ID do JWT contra essa blacklist em menos de 1ms, garantindo revogação instantânea e confiável.
8. Matriz de Rastreabilidade
Regra / Requisito	Código Documentado	Objetivo de Cobertura
RF-01 (Autenticação)	Seção 2 & Seção 6	Garante que usuários acessem o sistema apenas via JWT e cookies HTTP-only seguros.
RNF-01 (LGPD & Segurança)	Seção 3 & Seção 4	Aplicação das diretrizes da LGPD por meio de controle estrito de cookies contra vazamentos e criptografia padrão Argon2id.
RN-COB-02 (Bloqueio)	Seção 5	Validação contínua do contexto do tenant, impedindo requisições de contas suspensas por falta de pagamento.
RN-SLA-02 (Expediente)	Seção 5	O contexto injetado (tenantContext) provê o fuso horário necessário para calcular o SLA dinâmico do tenant ativo.