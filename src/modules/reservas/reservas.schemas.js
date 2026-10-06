/**
 * Contratos de entrada (Zod). A validação acontece na BORDA (middleware) e o
 * Service só recebe dados já tipados, normalizados e dentro dos limites.
 *
 * Princípio: allowlist, não blocklist — descrevemos o que É válido; todo o
 * resto é rejeitado com 400. Objetos são "strict": campos extras (ex.: status,
 * codigo, id) são recusados, prevenindo mass assignment.
 */
import { z } from 'zod';
import { RE_CODIGO_RESERVA } from '../../lib/codigo-reserva.js';
import { config } from '../../config/env.js';
import { isDataValida } from '../../lib/tempo.js';

export const dataISO = z
  .string({ error: 'Informe a data no formato AAAA-MM-DD' })
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use o formato AAAA-MM-DD')
  .refine(isDataValida, 'Data inexistente');

export const horaInicio = z
  .string({ error: 'Informe o horário no formato HH:MM' })
  .regex(/^([01]\d|2[0-3]):(00|15|30|45)$/, 'Use HH:MM em intervalos de 15 minutos (ex.: 14:30)');

// Letras de qualquer idioma (acentos inclusos), espaço, apóstrofo, ponto e hífen.
// Bloqueia <, >, ", &, etc. — o nome aparece no painel e no e-mail (defesa contra XSS armazenado).
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

// Aceita "(11) 91234-5678", "+55 11 91234-5678", "11912345678"... e armazena só dígitos (DDD + número).
export const telefone = z
  .string({ error: 'Informe o telefone' })
  .max(25, 'Telefone inválido')
  .regex(/^[\d\s()+.-]+$/, 'Telefone inválido')
  .transform((s) => s.replace(/\D/g, ''))
  .transform((d) => (d.length >= 12 && d.startsWith('55') ? d.slice(2) : d))
  .pipe(z.string().regex(/^[1-9]{2}\d{8,9}$/, 'Informe DDD + número (10 ou 11 dígitos)'));

export const email = z
  .string({ error: 'Informe o e-mail' })
  .trim()
  .toLowerCase()
  .max(254, 'E-mail muito longo')
  .pipe(z.email('E-mail inválido'));

export const consultarHorariosQuery = z.strictObject({ data: dataISO });

export const criarReservaBody = z.strictObject({
  data: dataISO,
  hora_inicio: horaInicio,
  duracao_min: z.union([z.literal(15), z.literal(30)], { error: 'A duração deve ser 15 ou 30 minutos' }),
  pessoas: z
    .number({ error: 'Informe o número de pessoas' })
    .int('Número de pessoas inválido')
    .min(1, 'Mínimo de 1 pessoa')
    .max(config.gatil.maxPessoasPorReserva, `Máximo de ${config.gatil.maxPessoasPorReserva} pessoas por reserva`),
  nome,
  telefone,
  email,
});

export const cancelarReservaParams = z.strictObject({
  codigo: z.string().regex(RE_CODIGO_RESERVA, 'Código inválido'),
});

// 24 bytes em base64url = 32 caracteres.
export const cancelarReservaBody = z.strictObject({
  token: z.string().regex(/^[A-Za-z0-9_-]{32}$/, 'Link inválido'),
});
