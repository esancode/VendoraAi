12. Arquitetura de Storage
Este documento estabelece as especificações técnicas detalhadas para a arquitetura de armazenamento de arquivos (Object Storage) do VendoraAI. Sob a filosofia de Simplicidade Radical e eficiência de custos, o sistema de arquivos gerencia mídias recebidas do WhatsApp (imagens, áudios e PDFs) garantindo o isolamento absoluto entre locatários (multi-tenancy) e o expurgo físico estrito de dados conforme exigido pela LGPD.

1. Stack Tecnológica de Armazenamento
Para balancear a escalabilidade massiva com baixíssimos custos fixos, o VendoraAI adota:

Provedor de Object Storage: Cloudflare R2 (ou qualquer armazenamento compatível com a API S3 da AWS, como AWS S3 ou MinIO para ambiente de desenvolvimento local).
Justificativa de Custo: O Cloudflare R2 oferece taxa zero de egresso (zero egress fees). Como o sistema trafega muitos arquivos de áudio para transcrição e imagens de comprovantes para os vendedores, eliminar o custo de transferência de rede reduz o custo operacional de infraestrutura em até 90% comparado ao AWS S3 tradicional.
SDK de Integração: @aws-sdk/client-s3 e @aws-sdk/s3-request-presigner (v3).
Varredura de Segurança (Opcional para Enterprise): ClamAV em container ou validação estrita de assinaturas binárias (Magic Bytes) na camada do Ingestion Engine para evitar execução de payloads maliciosos.
2. Estrutura de Isolamento (Multi-Tenancy)
O armazenamento de objetos utiliza uma estrutura de chaves estruturada e hierárquica baseada no identificador do Tenant (tenant_id). Isso garante que os dados de diferentes organizações estejam logicamente isolados no mesmo Bucket físico.

Padrão de Nomenclatura de Chaves (Keys)
Todas as chaves de objetos devem obrigatoriamente seguir a seguinte convenção:

tenants/{tenant_id}/leads/{lead_id}/{ano}-{mes}/{mensagem_id}-{uuid}.{extensao}
tenant_id: Identificador UUID do Tenant para garantir isolamento e permitir políticas de segurança de acesso.
lead_id: Identificador UUID do Lead associado à conversa.
ano}-{mes}: Agrupamento temporal (ex: 2026-08) para otimizar regras de particionamento e facilitar auditorias.
mensagem_id: ID da mensagem originária do WhatsApp (ou ID interno).
uuid: Hash único gerado pelo sistema para evitar colisões de arquivos com o mesmo nome original.
3. Segurança e Privacidade das Mídias
Para manter estrita conformidade com as regras de privacidade do VendoraAI e mitigar vulnerabilidades de vazamento de dados, são adotadas as seguintes regras de segurança:

3.1. Buckets 100% Privados
O bucket do Cloudflare R2 é configurado como completamente privado. Nenhuma mídia ou arquivo armazenado é acessível via URLs públicas ou navegáveis diretamente na web.

3.2. Acesso via Presigned URLs
Para que a Single Page Application (SPA) do vendedor ou o motor de IA consiga ler um arquivo (como renderizar uma imagem de comprovante no chat ou enviar um áudio para transcrição), o backend gera uma URL temporária assinada (Presigned URL).

Tempo de Vida Máximo (TTL): As URLs assinadas expiram obrigatoriamente em 15 minutos (expiresIn: 900).
Geração sob Demanda: A SPA solicita a URL temporária de leitura ao backend NestJS via HTTP sempre que o vendedor abre a tela de detalhes de um lead. O frontend nunca armazena ou faz cache de URLs assinadas.
4. Fluxo de Upload de Mídias (WhatsApp Cloud API)
Como o webhook do WhatsApp não envia o binário do arquivo diretamente, mas sim um identificador de mídia (media_id), o processamento de mídias é totalmente assíncrono e integrado à nossa arquitetura orientada a eventos.

Desenho do Fluxo de Ingestão de Mídia
[WhatsApp Cloud API]
       │
       ▼ (Webhook)
[Fastify Ingestion Gateway] ──(Valida assinatura e enfileira)──► [Redis (BullMQ)]
                                                                      │
                                                                      ▼
                                                             [Worker: media-downloader]
                                                                      │
                                                        ┌─────────────┴─────────────┐
                                                        ▼                           ▼
                                              (Baixa binário de              (Valida Magic Bytes
                                            Meta Cloud API)                 & Content-Type)
                                                        │                           │
                                                        └─────────────┬─────────────┘
                                                                      ▼
                                                            [Cloudflare R2 (S3)]
                                                                      │
                                                        (Salva chave de referência)
                                                                      ▼
                                                             [PostgreSQL (Prisma)]
                                                                      │
                                                         (Dispara notificação websocket)
                                                                      ▼
                                                             [SPA do Vendedor]
Detalhamento das Etapas:
Recepção do Webhook: O gateway de backend recebe a notificação contendo os metadados da mídia (mime_type, sha256, media_id). Ele responde instantaneamente com HTTP 200 ao WhatsApp para manter a latência abaixo de 50ms.
Enfileiramento: O gateway insere um job na fila media-downloader do BullMQ.
Download do Arquivo: O worker consome o job, realiza a autenticação na API do WhatsApp, faz o download temporário em memória (ou disco efêmero do container) do arquivo de mídia bruta.
Validação e Sanitização:
Valida se a extensão do arquivo condiz com o cabeçalho binário real do arquivo (Magic Bytes).
Bloqueia arquivos potencialmente executáveis.
Apenas mídias homologadas são aceitas:
Imagens: JPEG, PNG, WEBP (Limite de 5MB)
Áudio: OGG, MP3, WAV (Limite de 10MB - para transcrição de IA)
Documentos: PDF (Limite de 10MB - para notas e comprovantes)
Upload para o Cloudflare R2: O worker faz o upload do buffer diretamente para o R2 sob a chave de pasta do Tenant correspondente.
Persistência de Metadados: O caminho interno da chave (ex: tenants/t1/leads/l1/2026-08/file.png) é armazenado na tabela Message do PostgreSQL, marcando a mensagem como "processada".
Sincronização com o Frontend: Um evento é enviado via WebSockets (Socket.io) para o painel do vendedor, fazendo a interface buscar uma Presigned URL temporária para carregar a mídia na tela imediatamente.
5. Ciclo de Vida e Expurgo Físico (Conformidade LGPD)
Em consonância com as regras de conformidade e privacidade descritas na RN-PRIV-02 (retirada do documento de Regras de Negócio do VendoraAI), todos os registros originais de conversas e arquivos brutos devem ser expurgados fisicamente em no máximo 30 dias.

Mecanismo de Expurgo Física do Storage
O job diário de manutenção do backend, além de limpar os textos brutos das mensagens no banco relacional e os vetores de embeddings no pgvector, realiza o expurgo físico das mídias associadas no Object Storage:

Seleção de Mensagens Expiradas: O worker de expurgo identifica no banco todas as mensagens com data de criação (createdAt) superior a 30 dias que possuam referências a arquivos no storage.
Exclusão em Lote (Bulk Delete): O worker agrupa as chaves de objetos do Cloudflare R2 dessas mensagens expiradas e executa um comando DeleteObjectsCommand da API S3 para deletar permanentemente os arquivos físicos.
Remoção de Referências: No PostgreSQL, o campo de URL/caminho da mídia na tabela Message é atualizado para NULL, garantindo que não restem ponteiros para mídias inexistentes.
Nota: Não confiamos puramente em políticas nativas de Lifecycle do S3/R2 para essa regra comercial porque a exclusão no storage precisa estar perfeitamente sincronizada com a nulificação das colunas de texto no PostgreSQL, mantendo a integridade referencial dos relatórios estatísticos agregados.

6. Exemplo de Código do Adaptador de Storage (NestJS)
Abaixo está o exemplo conceitual do adaptador NestJS utilizando a biblioteca oficial AWS SDK v3, mapeando os contratos de portas e tratamento de mídias:

import { Injectable, Logger } from '@nestjs/common';
import { S3Client, PutObjectCommand, DeleteObjectsCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

@Injectable()
export class CloudflareR2StorageAdapter {
  private readonly s3Client: S3Client;
  private readonly bucketName = process.env.R2_BUCKET_NAME;
  private readonly logger = new Logger(CloudflareR2StorageAdapter.name);

  constructor() {
    this.s3Client = new S3Client({
      region: 'auto',
      endpoint: process.env.R2_ENDPOINT, // Ex: https://<account_id>.r2.cloudflarestorage.com
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
      },
    });
  }

  /**
   * Realiza o upload de um buffer de mídia de forma segura e privada
   */
  async uploadFile(
    tenantId: string,
    leadId: string,
    messageId: string,
    fileBuffer: Buffer,
    originalName: string,
    mimeType: string
  ): Promise<string> {
    const extension = originalName.split('.').pop() || 'bin';
    const yearMonth = new Date().toISOString().slice(0, 7); // Formato: YYYY-MM
    const randomUuid = crypto.randomUUID();

    // Constrói a chave estritamente isolada por Tenant
    const key = `tenants/${tenantId}/leads/${leadId}/${yearMonth}/${messageId}-${randomUuid}.${extension}`;

    await this.s3Client.send(
      new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        Body: fileBuffer,
        ContentType: mimeType,
        Metadata: {
          tenantId,
          leadId,
        },
      })
    );

    this.logger.log(`Arquivo salvo com sucesso no R2: ${key}`);
    return key;
  }

  /**
   * Gera uma URL de visualização temporária de no máximo 15 minutos (900 segundos)
   */
  async getPresignedDownloadUrl(key: string): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: key,
    });

    // Gera a assinatura de acesso seguro com expiração estrita
    return getSignedUrl(this.s3Client, command, { expiresIn: 900 });
  }

  /**
   * Remove fisicamente múltiplos arquivos durante a rotina diária de expurgo LGPD (30 dias)
   */
  async deleteObjects(keys: string[]): Promise<void> {
    if (keys.length === 0) return;

    const objectsToDelete = keys.map((key) => ({ Key: key }));

    try {
      await this.s3Client.send(
        new DeleteObjectsCommand({
          Bucket: this.bucketName,
          Delete: {
            Objects: objectsToDelete,
            Quiet: true,
          },
        })
      );
      this.logger.log(`Expurgo de mídias concluído: ${keys.length} arquivos deletados do R2.`);
    } catch (error) {
      this.logger.error(`Falha ao realizar expurgo de mídias no R2`, error.stack);
      throw error;
    }
  }
}
7. Tratamento de Falhas e Resiliência
Para mitigar interrupções e indisponibilidades, as seguintes estratégias são adotadas:

Timeout de Upload: O limite de conexão para o upload de mídias para o Cloudflare R2 é configurado para no máximo 5 segundos. Caso ocorra falha de rede, o BullMQ faz o reprocessamento utilizando backoff exponencial de 3 tentativas.
Limitação de Tamanho no Gateway: Arquivos que ultrapassam os limites especificados (10MB) são descartados na validação inicial do worker de download, prevenindo o esgotamento precoce de memória RAM nos containers de aplicação.
Armazenamento de Fallback Temporário: Se o Cloudflare R2 apresentar falha massiva temporária (fora do ar), as mídias críticas de áudio baixadas permanecem na fila do Redis por até 1 hora para reprocessamento, impedindo a perda imediata de mensagens ou interrupções nos relatórios.