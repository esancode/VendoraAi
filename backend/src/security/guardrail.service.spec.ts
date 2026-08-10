import { Test, TestingModule } from '@nestjs/testing';
import { GuardrailService } from './guardrail.service';

describe('GuardrailService', () => {
  let service: GuardrailService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [GuardrailService],
    }).compile();

    service = module.get<GuardrailService>(GuardrailService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should allow clean text without variables or links', () => {
    const draft = 'Olá, tudo bem? Como posso ajudar você hoje?';
    expect(service.validateDraft(draft)).toBe(true);
  });

  it('should allow valid unmask tags', () => {
    const draft = 'O seu CPF [CPF_MASKED_X1Y2Z3] já está cadastrado, e o email [EMAIL_MASKED_A1B2] também.';
    expect(service.validateDraft(draft)).toBe(true);
  });

  it('should block hallucinated variables like {nome}', () => {
    const draft = 'Olá {nome}, tudo bem com você?';
    expect(service.validateDraft(draft)).toBe(false);
  });

  it('should block hallucinated variables like [Nome_do_Lead]', () => {
    const draft = 'Olá [Nome_do_Lead], temos uma oferta.';
    expect(service.validateDraft(draft)).toBe(false);
  });

  it('should block external http links', () => {
    const draft = 'Veja mais em http://exemplo.com';
    expect(service.validateDraft(draft)).toBe(false);
  });

  it('should block external https links', () => {
    const draft = 'Veja mais em https://malicious.com/phishing';
    expect(service.validateDraft(draft)).toBe(false);
  });
});
