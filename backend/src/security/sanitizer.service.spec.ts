import { Test, TestingModule } from '@nestjs/testing';
import { SanitizerService } from './sanitizer.service';

// Mock Redis
jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => {
    return {
      set: jest.fn().mockResolvedValue('OK'),
      disconnect: jest.fn(),
    };
  });
});

describe('SanitizerService', () => {
  let service: SanitizerService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SanitizerService],
    }).compile();

    service = module.get<SanitizerService>(SanitizerService);
    service.onModuleInit();
  });

  afterAll(() => {
    service.onModuleDestroy();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should not modify content without sensitive data', async () => {
    const content = 'Hello, I want to know about your product.';
    const result = await service.sanitize(content, 'tenant1', 'msg1');
    expect(result).toBe(content);
  });

  it('should mask CPF', async () => {
    const content = 'Meu CPF é 123.456.789-00 por favor verifique.';
    const result = await service.sanitize(content, 'tenant1', 'msg1');
    expect(result).toContain('[CPF_MASKED_');
    expect(result).not.toContain('123.456.789-00');
    // @ts-ignore - access private member for test verification
    expect(service.redisClient.set).toHaveBeenCalled();
  });

  it('should mask email', async () => {
    const content = 'Pode me mandar um email no test@example.com?';
    const result = await service.sanitize(content, 'tenant1', 'msg2');
    expect(result).toContain('[EMAIL_MASKED_');
    expect(result).not.toContain('test@example.com');
  });

  it('should mask credit card (16 digits)', async () => {
    const content = 'Meu cartão: 1234 5678 1234 5678.';
    const result = await service.sanitize(content, 'tenant1', 'msg3');
    expect(result).toContain('[CARD_MASKED_');
    expect(result).not.toContain('1234 5678 1234 5678');
  });

  it('should mask multiple entities and store map in Redis', async () => {
    const content = 'CPF 11122233344 e email me@me.com';
    const result = await service.sanitize(content, 'tenant1', 'msg4');
    expect(result).toContain('[CPF_MASKED_');
    expect(result).toContain('[EMAIL_MASKED_');
    expect(result).not.toContain('11122233344');
    expect(result).not.toContain('me@me.com');

    // @ts-ignore
    const redisSetMock = service.redisClient.set as jest.Mock;
    expect(redisSetMock).toHaveBeenCalled();
    const args = redisSetMock.mock.calls[0];
    expect(args[0]).toBe('tenant:tenant1:sanitized:msg4');
    const mapping = JSON.parse(args[1]);
    expect(Object.values(mapping)).toContain('11122233344');
    expect(Object.values(mapping)).toContain('me@me.com');
    expect(args[2]).toBe('EX');
    expect(args[3]).toBe(900); // 15 min TTL
  });
});
