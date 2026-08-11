# Estágio 1: Builder
FROM node:20-alpine AS builder

# Instalar dependências para compilação (necessário para alguns pacotes nativos e prisma)
RUN apk add --no-cache openssl python3 make g++

WORKDIR /usr/src/app

# Copiar arquivos de dependências
COPY package.json package-lock.json ./
COPY prisma ./prisma/

# Instalar dependências (incluindo devDependencies necessárias para build)
RUN npm ci

# Copiar o restante do código do backend
COPY . .

# Gerar Prisma Client
RUN npx prisma generate

# Fazer o build do NestJS (transpilar TypeScript para dist/)
RUN npm run build

# Estágio 2: Production Runner
FROM node:20-alpine AS runner

# Bibliotecas necessárias em tempo de execução para o Prisma no Alpine
RUN apk add --no-cache openssl

WORKDIR /usr/src/app

# Copiar o package.json e package-lock.json para instalar apenas prod deps
COPY package.json package-lock.json ./

# Instalar dependências de compilação temporariamente para pacotes nativos (como argon2), instalar módulos e limpar
RUN apk add --no-cache python3 make g++ && \
    npm ci --only=production && \
    apk del python3 make g++ && \
    npm cache clean --force

# Copiar o Prisma gerado (node_modules/.prisma) e schemas
COPY --from=builder /usr/src/app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /usr/src/app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /usr/src/app/prisma ./prisma

# Copiar o diretório de build
COPY --from=builder /usr/src/app/dist ./dist

# Copiar script de deploy
COPY deploy.sh ./
RUN chmod +x deploy.sh

# Variáveis de ambiente de produção e porta padrão
ENV NODE_ENV=production
ENV PORT=3000

# Expor a porta
EXPOSE 3000

# Executar script de inicialização do deploy e subir o app
CMD ["./deploy.sh"]
