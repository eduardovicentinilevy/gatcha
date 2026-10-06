import { z } from 'zod';
import { nome } from '../reservas/reservas.schemas.js';

const contatoEmail = z.email();
const contatoTelefone = /^[1-9]{2}\d{8,9}$/;

/** E-mail ou celular com DDD. Guarda e-mail em minúsculas ou só os dígitos do telefone (sem +55). */
const contato = z
  .string({ error: 'Informe um e-mail ou celular' })
  .trim()
  .max(254, 'Contato muito longo')
  .transform((valor, ctx) => {
    if (valor.includes('@')) {
      const email = valor.toLowerCase();
      if (contatoEmail.safeParse(email).success) return email;
    } else if (/^[\d\s()+.-]+$/.test(valor)) {
      let digitos = valor.replace(/\D/g, '');
      if (digitos.length >= 12 && digitos.startsWith('55')) digitos = digitos.slice(2);
      if (contatoTelefone.test(digitos)) return digitos;
    }
    ctx.addIssue({ code: 'custom', message: 'Informe um e-mail válido ou um celular com DDD' });
    return z.NEVER;
  });

// Sem caracteres de controle; quebras de linha simples são permitidas.
const mensagem = z
  .string()
  .max(1000, 'Mensagem muito longa')
  .transform((s) => s.replace(/[^\P{Cc}\n]/gu, '').trim())
  .transform((s) => s || null);

export const criarInteresseBody = z.strictObject({
  gato_id: z.number({ error: 'Escolha um gato' }).int().positive(),
  nome,
  contato,
  mensagem: mensagem.optional().transform((m) => m ?? null),
});
