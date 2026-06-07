import { Injectable } from '@nestjs/common';

const BLOCKED_PATTERNS = [
  /ignore\s+(all\s+)?previous\s+instructions/i,
  /ignore\s+(as\s+)?instru[cç][oõ]es/i,
  /system\s+prompt/i,
  /developer\s+message/i,
  /revele?\s+(segredos?|secrets?|tokens?|chaves?)/i,
  /exfiltrate|data\s+exfiltration/i,
  /acesse\s+documentos?\s+de\s+outro\s+tenant/i,
];

@Injectable()
export class PromptInjectionGuardrail {
  classify(input: string) {
    const matches = BLOCKED_PATTERNS
      .filter((pattern) => pattern.test(input))
      .map((pattern) => pattern.source);

    return {
      blocked: matches.length > 0,
      matches,
    };
  }
}
