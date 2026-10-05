import { z } from 'zod';

// No login NÃO aplicamos a política de senha (só o limite de tamanho): quem entra
// com senha antiga não deve receber dica de regra; e o corpo é pequeno.
export const loginBody = z.strictObject({
  email: z.string({ error: 'Informe o e-mail' }).trim().toLowerCase().max(254).pipe(z.email('E-mail inválido')),
  senha: z.string({ error: 'Informe a senha' }).min(1, 'Informe a senha').max(200, 'Senha inválida'),
});
