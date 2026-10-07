/** Validações reaproveitadas pela API (Zod). */
import { z } from 'zod';

// Letras de qualquer idioma (acentos inclusos), espaço, apóstrofo, ponto e hífen.
// Bloqueia <, >, ", &, etc. — o nome aparece no painel (defesa contra XSS armazenado).
export const nome = z
  .string({ error: 'Informe o nome' })
  .max(200, 'Nome muito longo')
  .transform((s) => s.normalize('NFC').trim().replace(/\s+/g, ' '))
  .pipe(
    z
      .string()
      .min(2, 'Nome muito curto')
      .max(100, 'Nome deve ter no máximo 100 caracteres')
      .regex(/^\p{L}[\p{L}\p{M}' .-]*$/u, 'Use apenas letras, espaços, apóstrofo, ponto e hífen'),
  );
