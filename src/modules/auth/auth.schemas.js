import { z } from 'zod';

/** Código de 6 dígitos do app autenticador. Aceita "123 456" (como alguns apps mostram). */
const codigo = z
  .string({ error: 'Informe o código do app' })
  .max(20, 'Código inválido')
  .transform((s) => s.replace(/\s/g, ''))
  .pipe(z.string().regex(/^\d{6}$/, 'O código tem 6 dígitos'));

// No login NÃO aplicamos a política de senha (só o limite de tamanho): quem entra
// com senha antiga não deve receber dica de regra; e o corpo é pequeno.
export const loginBody = z.strictObject({
  email: z.string({ error: 'Informe o e-mail' }).trim().toLowerCase().max(254).pipe(z.email('E-mail inválido')),
  senha: z.string({ error: 'Informe a senha' }).min(1, 'Informe a senha').max(200, 'Senha inválida'),
  // Só para quem ativou o 2FA (vazio = sem código).
  codigo: z.preprocess((v) => (typeof v === 'string' && v.trim() === '' ? undefined : v), codigo.optional()),
});

/** Ativar ou desativar o 2FA pelo painel: senha atual + código do app. */
export const confirmar2faBody = z.strictObject({
  senha: z.string({ error: 'Informe a senha' }).min(1, 'Informe a senha').max(200, 'Senha inválida'),
  codigo,
});
