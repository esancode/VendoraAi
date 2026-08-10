import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class GuardrailService {
  private readonly logger = new Logger(GuardrailService.name);

  // Regex para achar templates como {nome}, [Lead_Name], mas IGNORANDO as mascaras locais que começam com [ e terminam com _MASKED_XXXXXXXX]
  // Vamos buscar por chaves simples: \{.*?\} 
  // e colchetes que não contêm _MASKED_: \[(?!.*_MASKED_).*?\]
  private readonly unmappedVarRegex = /\{.*?\}|\[(?!.*_MASKED_).*?\]/g;
  
  // Regex para detectar links HTTP(s)
  private readonly linkRegex = /https?:\/\/[^\s]+/g;

  /**
   * Valida se a resposta gerada é segura e não contém alucinações de templates ou links indevidos.
   * @param draft Rascunho gerado pela IA.
   * @returns boolean (true se seguro, false se falhou nos guardrails)
   */
  validateDraft(draft: string): boolean {
    if (!draft) return false;

    // 1. Checar vazamento de variáveis/templates
    const varMatches = draft.match(this.unmappedVarRegex);
    if (varMatches && varMatches.length > 0) {
      this.logger.warn(`Guardrail bloqueou resposta devido a vazamento de variável/template: ${varMatches.join(', ')}`);
      return false;
    }

    // 2. Checar links externos (bloqueio total para essa versão inicial)
    const linkMatches = draft.match(this.linkRegex);
    if (linkMatches && linkMatches.length > 0) {
      this.logger.warn(`Guardrail bloqueou resposta devido a link externo detectado: ${linkMatches.join(', ')}`);
      return false;
    }

    return true;
  }
}
