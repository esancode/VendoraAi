Arquitetura de Segurança e Conformidade (LGPD)
Este documento estabelece as especificações de segurança da informação, mitigação de vulnerabilidades e estratégias de conformidade com a Lei Geral de Proteção de Dados (LGPD) para o VendoraAI. Sob a premissa de que a plataforma atua como uma camada de inteligência comercial sobre conversas do WhatsApp de pequenas e médias empresas (PMEs), a segurança é projetada em camadas profundas (Defense-in-Depth) para garantir o isolamento transacional completo e o controle rígido sobre dados pessoais e sensíveis.

1. Princípios de Segurança do VendoraAI
Privacidade por Design (Privacy by Design): Toda nova funcionalidade é concebida assumindo que dados transacionais brutos pertencem ao cliente final do Tenant e possuem tempo de vida limitado na plataforma.
Menor Privilégio (Least Privilege): Agentes de execução, usuários e conexões de bancos de dados possuem estritamente as permissões mínimas necessárias para a realização de suas operações lógicas.
Isolamento de Tenants Primitivo: O isolamento multi-tenant não é uma regra aplicada apenas em nível de aplicação, mas é garantido de forma matemática na camada de banco de dados (Row-Level Security) e de criptografia.
Zero Confiança Externa (Zero Trust on Third-Parties): Provedores de IA terceiros e APIs externas são tratados como zonas de segurança não confiáveis. Todos os dados enviados a eles são previamente higienizados de forma determinística na infraestrutura local do VendoraAI.
2. Mitigação do OWASP Top 10 (Aplicações Web e APIs)
A arquitetura do VendoraAI neutraliza as vulnerabilidades mais críticas listadas pela fundação OWASP por meio de mecanismos estruturais nativos:

A01:2021 - Controle de Acesso Quebrado (Broken Access Control)
Ameaça: Invasão lateral (um Tenant acessando registros de outro) e escalada vertical de privilégios (vendedor alterando configurações de pagamento).
Mitigação:
Row-Level Security (RLS) no PostgreSQL: Todas as consultas transacionais aplicam automaticamente a cláusula de isolamento baseada na variável de sessão app.current_tenant_id instanciada pelo middleware do NestJS.
Políticas CASL (ABAC): O backend avalia as permissões granulares de posse do objeto (ex: "vendedor só gerencia leads atribuídos a si mesmo") antes de autorizar o endpoint do controller.
A02:2021 - Falhas Criptográficas (Cryptographic Failures)
Ameaça: Exposição de dados de leads (nomes, telefones, históricos) em trânsito ou repouso, e vazamento de senhas.
Mitigação:
TLS 1.3 Obrigatório: Toda comunicação HTTPS e WSS (WebSockets) rejeita protocolos legados (rejeição de SSL v3, TLS 1.0 e 1.1).
Hashing com Argon2id: Senhas dos usuários são cifradas localmente utilizando os parâmetros de alta segurança recomendados pela OWASP.
Criptografia em Nível de Aplicação (ALE): Dados pessoais sensíveis de leads (PII) são criptografados com AES-256-GCM antes da escrita física no PostgreSQL.
A03:2021 - Injeção (Injection)
Ameaça: Ataques de SQL Injection no banco ou injeções de cabeçalhos que quebram o interpretador.
Mitigação:
Prisma ORM Parametrizado: O mapeador objeto-relacional força o uso de consultas parametrizadas (Prepared Statements) nativamente, impedindo manipulações de strings SQL nos inputs de formulários.
Validação Estrita via Zod: Esquemas de entrada de requisições validam tipos, formatos e tamanhos máximos de dados em tempo de execução antes que qualquer lógica de negócio seja acionada.
A04:2021 - Design Inseguro (Insecure Design)
Ameaça: Fluxos de arquitetura que deixam o sistema vulnerável por falhas na modelagem de processos.
Mitigação:
Arquitetura Hexagonal: Separação rígida de Domínio e Infraestrutura. Caso as bibliotecas de autenticação ou APIs de mensageria tenham vulnerabilidades conhecidas no futuro, elas podem ser atualizadas ou substituídas sem afetar o núcleo da lógica de vendas.
Processamento Assíncrono Desacoplado: Ingestão de mensagens isolada das chamadas de IA. Picos de tráfego que poderiam induzir falhas de estouro de memória (OOM) no orquestrador são retidos e organizados nas filas gerenciadas pelo Redis/BullMQ.
A05:2021 - Configuração Incorreta de Segurança (Security Misconfiguration)
Ameaça: Mensagens de erro contendo trace de pilha, portas abertas e cabeçalhos de segurança ausentes.
Mitigação:
Middleware Fastify Helmet: Adiciona automaticamente cabeçalhos HTTP de segurança de ponta (como Content-Security-Policy, X-Frame-Options para prevenção de clickjacking, e Strict-Transport-Security).
Tratamento de Erros Centralizado: Filtro global do NestJS captura exceções inesperadas e substitui o retorno detalhado de erro em produção por um código de rastreamento estéril (v-error-xxxx), enviando a pilha detalhada apenas ao sistema de monitoramento interno.
A06:2021 - Componentes Vulneráveis e Desatualizados (Vulnerable and Outdated Components)
Ameaça: Uso de pacotes npm de terceiros com brechas críticas conhecidas.
Mitigação:
Auditoria Automatizada em CI/CD: Integração de ferramentas como npm audit e Snyk nos pipelines de Deploy. Builds de produção são interrompidas automaticamente caso qualquer dependência introduza uma vulnerabilidade categorizada como "Alta" ou "Crítica".
A07:2021 - Falhas de Identificação e Autenticação (Identification and Authentication Failures)
Ameaça: Ataques de força bruta, sequestro de sessões ativas e roubo de tokens.
Mitigação:
Refresh Token Rotation (RTR): Implementação de cadeia de atualização de tokens em memória no Redis. Tentativas de reutilizar um refresh token antigo resultam na invalidação imediata de toda a família de sessões ativas daquele usuário.
Cookies HttpOnly & Secure: Tokens de autenticação são salvos no navegador em áreas inacessíveis via JavaScript (document.cookie), mitigando ataques baseados em XSS (Cross-Site Scripting).
A08:2021 - Falhas de Integridade de Software e Dados (Software and Data Integrity Failures)
Ameaça: Ingestão de dados falsificados via webhooks ou falsificação de atualizações.
Mitigação:
Validação de Webhooks por Assinatura: O sistema recusa qualquer payload recebido que não contenha a assinatura digital correspondente (criptografia SHA-256 gerada com chave HMAC simétrica) do Facebook/WhatsApp e do gateway de pagamentos.
A09:2021 - Falhas de Registro e Monitoramento de Segurança (Security Logging and Monitoring Failures)
Ameaça: Ataques que ocorrem sem que a equipe perceba devido à ausência de logs ou logs poluídos com informações sensíveis.
Mitigação:
Trilha de Auditoria Criptografada: Ações administrativas (ex: alteração de planos de Tenant, exclusão física de registros) são salvas em formato JSON estruturado em logs persistentes e assinadas criptograficamente para evitar adulteração pós-incidente.
Mascaramento de Logs (Sanitization): O formatador de logs (Pino) possui interceptores globais para ocultar chaves de APIs, tokens de cabeçalhos e campos de senhas de usuários.
A10:2021 - Falsificação de Requisição do Lado do Servidor (SSRF)
Ameaça: O backend ser induzido a baixar arquivos de URLs internas ou maliciosas durante o download de mídias do WhatsApp.
Mitigação:
Validação Estrita de URLs de Origem: O serviço que realiza o download de imagens e áudio (media-downloader) valida se a URL do arquivo de mídia de origem pertence estritamente ao domínio oficial homologado da API do WhatsApp Cloud (graph.facebook.com), rejeitando requisições para IPs de rede privada local (localhost, 127.0.0.1, 10.0.0.0/8).
3. Conformidade estrita com a LGPD
O VendoraAI opera como Operador de Dados sob a égide da LGPD, processando dados comerciais sob comando e em nome do Controlador de Dados (o Tenant / PME contratante). Todas as ações respeitam os direitos fundamentais de privacidade definidos na legislação brasileira:

                  ┌───────────────────────────────┐
                  │      WhatsApp Webhook         │
                  └───────────────┬───────────────┘
                                  │
                                  ▼
                  ┌───────────────────────────────┐
                  │   Pre-flight Sanitizer (Local)│
                  └───────────────┬───────────────┘
                                  │ (Mascara PII: CPF, Cartão...)
                                  ▼
                  ┌───────────────────────────────┐
                  │  Envia para LLM Externa (IA)  │
                  └───────────────┬───────────────┘
                                  │
                                  ▼
                  ┌───────────────────────────────┐
                  │       Post-flight Merge       │
                  └───────────────┬───────────────┘
                                  │ (Reconstitui os dados reais)
                                  ▼
                  ┌───────────────────────────────┐
                  │ PostgreSQL (Criptografia ALE) │
                  └───────────────┬───────────────┘
                                  │
                                  ▼ (Após 30 dias corridos)
                  ┌───────────────────────────────┐
                  │ Expurgo Físico Total (Purge) │
                  └───────────────────────────────┘
A. Mecanismo Pre-flight Sanitizer (Mascaramento de PII)
Antes de enviar qualquer bloco de conversa do lead para modelos de linguagem de terceiros (como OpenAI ou Google Gemini), o orquestrador do backend NestJS intercepta a string de conversa e aplica um filtro local com expressões regulares (Regex) e técnicas de processamento de texto local para anonimizar campos críticos:

Identificadores Pessoais: CPFs (ex: ***.***.***-**), RG, CNPJs de clientes físicos, data de nascimento.
Dados de Pagamento: Números de cartões de crédito (Padrão PAN), códigos de segurança (CVV).
Mapeamento de Reconstituição: Um mapa "De-Para" temporário (ex: UUID_1234 -> "Nome do Lead") é armazenado na memória cache ultraveloz do Redis com tempo de vida (TTL) de 15 minutos. Quando a LLM retorna a análise do texto ou rascunho de resposta estruturada, o backend lê esse mapa no Redis e substitui as máscaras de volta pelos dados reais antes de exibi-los ao vendedor humano no frontend do sistema.
B. Ciclo de Vida e Expurgo Físico de Dados (30 Dias)
De acordo com o princípio da Minimização de Dados e a regra operacional RN-PRIV-02, o histórico de diálogos brutos e as mídias associadas possuem retenção transitória e são expurgados do banco de dados ativo após 30 dias de sua criação:

O que é removido permanentemente:
Tabela Message: O campo raw_content (texto bruto da mensagem) é atualizado para NULL ou substituído por uma assinatura estéril de remoção.
Tabela MessageEmbedding: Os vetores armazenados no pgvector correspondentes à mensagem deletada são eliminados por completo em cascata, impedindo qualquer recuperação por busca semântica no futuro.
Cloudflare R2: Arquivos de mídia de imagem, áudios brutas e anexos baixados do WhatsApp vinculados a essa conversa são apagados de forma definitiva do bucket privado.
O que permanece para Inteligência Comercial:
Permanecem intactos apenas os dados de negócios consolidados e agregados que não expõem a intimidade do cliente, tais como: resumos narrativos curtos gerados pela IA no fechamento do lead, motivos de perda do lead mapeados (ex: preço, entrega), datas de tráfego, ID do vendedor associado, e tempo agregado de SLA de resposta para geração de métricas de desempenho.
C. Direito à Exclusão (Right to be Forgotten)
Caso o cliente final de um Tenant acione o suporte solicitando a remoção de todos os seus dados pessoais do sistema, o VendoraAI disponibiliza um endpoint administrativo protegido para Exclusão Manual Imediata (Cascade Purge):

O administrador aciona o comando informando o lead_id.
O sistema executa uma transação de exclusão de dados: remove o registro do lead na tabela Lead, deleta todas as mensagens, expurga os vetores em pgvector e aciona o comando para remoção síncrona dos arquivos no Cloudflare R2.
Um log assinado de auditoria confirma a realização do expurgo com sucesso (exibindo apenas o ID anonimizado do comando).
4. Criptografia em Nível de Aplicação (Application-Level Encryption - ALE)
Enquanto a criptografia tradicional protege o banco de dados contra cópias não autorizadas do disco rígido da máquina (TDE), o VendoraAI implementa Criptografia em Nível de Aplicação (ALE). Isso significa que mesmo que um atacante obtenha acesso privilegiado de leitura (Read-Only) diretamente ao banco de dados relacional PostgreSQL (por vazamento de credenciais ou injeções SQL parciais), as informações críticas e dados pessoais identificáveis (PII) dos leads permanecerão ilegíveis, exibidos na forma de strings cifradas em formato hexadecimal.

Mecanismo de Cifragem (AES-256-GCM)
O ecossistema de criptografia do NestJS utiliza o algoritmo simétrico AES-256-GCM (Advanced Encryption Standard no modo Galois/Counter Mode). Esse modo fornece criptografia autenticada, garantindo não apenas a confidencialidade dos dados, mas também a integridade lógica (qualquer alteração maliciosa no banco de dados na string criptografada impedirá a decifragem do registro, gerando alertas de intrusão).

Abaixo está a implementação de engenharia sênior que gerencia a criptografia transparente de atributos sensíveis antes do salvamento e recuperação do banco:

// src/common/infrastructure/security/encryption.service.ts
import { Injectable, InternalServerErrorException } from '@nestjs/common';
import * as crypto from 'crypto';

@Injectable()
export class EncryptionService {
  private readonly algorithm = 'aes-256-gcm';
  private readonly key: Buffer;

  constructor() {
    const masterKey = process.env.ENCRYPTION_MASTER_KEY;
    if (!masterKey || masterKey.length !== 64) {
      throw new InternalServerErrorException(
        'ENCRYPTION_MASTER_KEY deve ser uma string hex de exatamente 64 caracteres (256 bits).'
      );
    }
    this.key = Buffer.from(masterKey, 'hex');
  }

  /**
   * Criptografa uma string usando AES-256-GCM
   * Retorna formato seguro: iv:authTag:ciphertext
   */
  encrypt(plainText: string): string {
    try {
      const iv = crypto.randomBytes(12); // Vetor de Inicialização único de 12 bytes para GCM
      const cipher = crypto.createCipheriv(this.algorithm, this.key, iv);

      let encrypted = cipher.update(plainText, 'utf8', 'hex');
      encrypted += cipher.final('hex');

      const authTag = cipher.getAuthTag().toString('hex'); // Tag de autenticação de integridade de 16 bytes

      return `${iv.toString('hex')}:${authTag}:${encrypted}`;
    } catch (error) {
      throw new InternalServerErrorException('Falha ao criptografar dados confidenciais.');
    }
  }

  /**
   * Decriptografa dados seguros no formato iv:authTag:ciphertext
   */
  decrypt(cipherText: string): string {
    try {
      const parts = cipherText.split(':');
      if (parts.length !== 3) {
        throw new Error('Formato criptográfico inválido.');
      }

      const iv = Buffer.from(parts[0], 'hex');
      const authTag = Buffer.from(parts[1], 'hex');
      const encryptedText = parts[2];

      const decipher = crypto.createDecipheriv(this.algorithm, this.key, iv);
      decipher.setAuthTag(authTag);

      let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;
    } catch (error) {
      throw new InternalServerErrorException('Falha ao decifrar dados. Chave corrompida ou dados violados.');
    }
  }
}
Configuração no Prisma ORM (Mapeamento de Entidades)
A decodificação e criptografia de atributos como name, phone e email do lead são executadas de forma automática pelo backend em interceptores do NestJS ou em Prisma Middlewares/Extensions nas leituras e escritas das tabelas para que os controllers e serviços de domínio sempre trabalhem com dados limpos em memória.

5. Gerenciamento Seguro de Segredos e Credenciais
Nenhum segredo de ambiente, token de API externa (WhatsApp, Google, Stripe) ou credencial de banco de dados é salvo no repositório de código fonte do Git. O ecossistema de deploy do VendoraAI utiliza um modelo de gerenciamento baseado nas melhores práticas de segurança na nuvem:

Armazenamento Isolado de Segredos (Vault): Em ambientes de staging e produção, o gerenciamento de credenciais de banco e chaves simétricas de criptografia é delegado a serviços especializados de gerenciamento de segredos (como AWS Secrets Manager ou Cloudflare Variables de Produção criptografadas).
Injeção Dinâmica em Tempo de Execução: Os contêineres Docker recebem esses segredos estritamente como variáveis de ambiente em tempo de execução, impedindo qualquer gravação física em disco de dados confidenciais.
Rotação de Chaves de Criptografia: A chave mestra simétrica do banco (ENCRYPTION_MASTER_KEY) é atualizada periodicamente. O backend possui scripts de migração que lêem os registros legados com a chave antiga e os re-criptografam com a nova chave mestra sem gerar indisponibilidade do sistema.
6. Prevenção e Monitoramento de Fraudes (IDS)
O VendoraAI monitora e mitiga comportamentos maliciosos e picos imprevistos na rede com regras de detecção de anomalias:

Mitigação de Bruteforce e Scrapers: A rota de login de usuários implementa bloqueios temporários de IP no Redis caso ocorram mais de 5 tentativas inválidas consecutivas de senha para uma mesma conta.
Sliding Window Rate Limiting: Limitação estrita de requisições por API Gateway no Redis, protegendo o sistema de picos artificiais de carga de webhooks originados do WhatsApp e mitigando vetores de ataque DDoS.
IDS de Tentativas de Evasão Multi-Tenant: Qualquer consulta de banco de dados que retorne uma violação de acesso em nível de Row-Level Security (ex: tentativa de ler um lead de outro tenant_id) interrompe imediatamente o fluxo da aplicação, invalida o Token JWT do solicitante, e emite um alerta de severidade crítica P0 para as equipes de monitoramento e SRE.