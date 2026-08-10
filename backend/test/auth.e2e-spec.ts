import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { PasswordHasherService } from '../src/auth/services/password-hasher.service';

import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';

describe('AuthController (e2e)', () => {
  let app: NestFastifyApplication;
  let prisma: PrismaService;
  let passwordHasher: PasswordHasherService;

  let tenantId: string;
  let userId: string;
  let rawPassword = 'securePassword123';

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    
    // Configurar cookies para testes
    // O Fastify require plugins adicionais
    const fastifyCookie = require('@fastify/cookie');
    app.getHttpAdapter().getInstance().register(fastifyCookie, {
      secret: 'my-secret', 
    });

    await app.init();
    await app.getHttpAdapter().getInstance().ready();

    prisma = app.get<PrismaService>(PrismaService);
    passwordHasher = app.get<PasswordHasherService>(PasswordHasherService);

    // Limpar o banco de dados
    await prisma.$executeRawUnsafe(`SET LOCAL app.current_tenant_id = ''`);
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE tenants CASCADE`);

    // Criar um tenant e usuário
    const tenant = await prisma.tenant.create({
      data: { name: 'Tenant Auth Test' },
    });
    tenantId = tenant.id;

    const hashedPassword = await passwordHasher.hash(rawPassword);

    const user = await prisma.user.create({
      data: {
        email: 'test@auth.com',
        passwordHash: hashedPassword,
        name: 'Test User',
        role: 'AGENT',
        tenantId,
      },
    });
    userId = user.id;
  });

  afterAll(async () => {
    await prisma.$executeRawUnsafe(`SET LOCAL app.current_tenant_id = ''`);
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE tenants CASCADE`);
    await app.close();
  });

  let validRefreshToken: string;
  let validAccessToken: string;

  const extractCookie = (cookieStr: string, name: string) => {
    const match = cookieStr.match(new RegExp('(^|;\\s*)(' + name + ')=([^;]*)'));
    return match ? decodeURIComponent(match[3]) : null;
  };

  it('/api/v1/auth/login (POST) - Sucesso', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {
        email: 'test@auth.com',
        password: rawPassword,
      },
    });

    expect(response.statusCode).toEqual(200);
    const body = JSON.parse(response.payload);
    expect(body.accessToken).toBeDefined();
    validAccessToken = body.accessToken;

    // Verificar o Cookie HTTP-Only
    const setCookieHeader = response.headers['set-cookie'];
    expect(setCookieHeader).toBeDefined();
    expect(Array.isArray(setCookieHeader) ? setCookieHeader[0] : setCookieHeader).toContain('refresh_token=');
    
    // Extrair Refresh Token do cookie
    const cookieHeaderStr = Array.isArray(setCookieHeader) ? setCookieHeader[0] : (setCookieHeader as string);
    validRefreshToken = extractCookie(cookieHeaderStr, 'refresh_token')!;
  });

  it('/api/v1/auth/login (POST) - Falha com senha incorreta', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {
        email: 'test@auth.com',
        password: 'wrongpassword',
      },
    });

    expect(response.statusCode).toEqual(401);
  });

  it('/api/v1/auth/refresh (POST) - Sucesso RTR', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/refresh',
      cookies: {
        refresh_token: validRefreshToken,
      },
    });

    expect(response.statusCode).toEqual(200);
    const body = JSON.parse(response.payload);
    expect(body.accessToken).toBeDefined();

    const setCookieHeader = response.headers['set-cookie'];
    expect(setCookieHeader).toBeDefined();
    const cookieHeaderStr = Array.isArray(setCookieHeader) ? setCookieHeader[0] : (setCookieHeader as string);
    const newRefreshToken = extractCookie(cookieHeaderStr, 'refresh_token');
    
    // O Refresh Token deve ser rotacionado (RTR)
    expect(newRefreshToken).not.toEqual(validRefreshToken);
    validRefreshToken = newRefreshToken!; // Guardar o novo
  });

  it('/api/v1/auth/refresh (POST) - Falha Anti-abuso (Reuso de token antigo)', async () => {
    // Para testar o anti-abuso, primeiro fazemos login para obter um token
    const loginResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {
        email: 'test@auth.com',
        password: rawPassword,
      },
    });

    const setCookieHeader = loginResponse.headers['set-cookie'];
    const cookieHeaderStr = Array.isArray(setCookieHeader) ? setCookieHeader[0] : (setCookieHeader as string);
    const originalRefreshToken = extractCookie(cookieHeaderStr, 'refresh_token');

    // Faz o primeiro refresh com sucesso
    await app.inject({
      method: 'POST',
      url: '/api/v1/auth/refresh',
      cookies: {
        refresh_token: originalRefreshToken,
      },
    });

    // Tenta reusar o refresh token antigo, simulando um atacante
    const abuseResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/refresh',
      cookies: {
        refresh_token: originalRefreshToken,
      },
    });

    expect(abuseResponse.statusCode).toEqual(401);
  });
});
