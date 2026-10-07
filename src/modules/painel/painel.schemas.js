/**
 * Contratos de entrada do painel. Mesma regra do resto da API: allowlist, objetos
 * "strict" (campo extra = erro, evita mass assignment) e normalização na borda.
 */
import { z } from 'zod';

const id = z.string().regex(/^[1-9]\d{0,15}$/, 'Identificador inválido').transform(Number);
export const idParams = z.strictObject({ id });

/** Texto livre: sem caracteres de controle (quebra de linha simples permitida), aparado; vazio vira null. */
const textoOpcional = (max) =>
  z
    .string()
    .max(max * 2, `Máximo de ${max} caracteres`)
    .transform((s) => s.replace(/[^\P{Cc}\n]/gu, '').trim())
    .pipe(z.string().max(max, `Máximo de ${max} caracteres`))
    .transform((s) => s || null)
    .nullable();

const textoCurto = (rotulo, min, max) =>
  z
    .string({ error: `Informe ${rotulo}` })
    .max(max * 2, `${rotulo} muito longo`)
    .transform((s) => s.replace(/\p{Cc}/gu, '').normalize('NFC').trim().replace(/\s+/g, ' '))
    .pipe(z.string().min(min, `${rotulo} muito curto`).max(max, `Máximo de ${max} caracteres`));

// Link https ou arquivo do próprio site (ex.: /img/gatos/matcha.jpg).
const fotoUrl = z
  .string()
  .trim()
  .max(500, 'Link muito longo')
  .regex(/^(https:\/\/[^\s]+|\/[^/\s][^\s]*)$/, 'Use um link https:// ou um caminho como /img/gatos/matcha.jpg')
  .nullable();

/** PATCH: pelo menos um campo. */
const algumCampo = (schema) => schema.refine((o) => Object.keys(o).length > 0, 'Envie ao menos um campo para alterar');

// ---------------------------------------------------------------- gatos
const gatoCampos = {
  nome: textoCurto('o nome', 1, 60).pipe(z.string().regex(/^\p{L}[\p{L}\p{M}0-9' .-]*$/u, 'Use letras, números, espaço, apóstrofo, ponto e hífen')),
  idade_meses: z.number().int('Use um número inteiro').min(0).max(360, 'Máximo de 360 meses').nullable(),
  sexo: z.enum(['macho', 'femea']),
  personalidade: textoOpcional(500),
  foto_url: fotoUrl,
  status: z.enum(['disponivel', 'em_processo', 'adotado']),
};
export const criarGatoBody = z.strictObject({
  nome: gatoCampos.nome,
  sexo: gatoCampos.sexo,
  idade_meses: gatoCampos.idade_meses.optional().transform((v) => v ?? null),
  personalidade: gatoCampos.personalidade.optional().transform((v) => v ?? null),
  foto_url: gatoCampos.foto_url.optional().transform((v) => v ?? null),
  status: gatoCampos.status.default('disponivel'),
});
export const alterarGatoBody = algumCampo(z.strictObject(Object.fromEntries(Object.entries(gatoCampos).map(([k, v]) => [k, v.optional()]))));

// ---------------------------------------------------------------- cardápio
const SELOS = ['mais_pedido', 'vegano', 'novo'];
const itemCampos = {
  categoria: textoCurto('a categoria', 2, 40),
  nome: textoCurto('o nome', 2, 100),
  descricao: textoOpcional(500),
  preco_centavos: z.number().int('Preço inválido').min(0, 'Preço inválido').max(10_000_000, 'Preço alto demais'),
  ativo: z.boolean(),
  selos: z.array(z.enum(SELOS)).max(SELOS.length).transform((s) => [...new Set(s)]),
  foto_url: fotoUrl,
};
export const criarItemBody = z.strictObject({
  categoria: itemCampos.categoria,
  nome: itemCampos.nome,
  preco_centavos: itemCampos.preco_centavos,
  descricao: itemCampos.descricao.optional().transform((v) => v ?? null),
  ativo: itemCampos.ativo.default(true),
  selos: itemCampos.selos.default([]),
  foto_url: itemCampos.foto_url.optional().transform((v) => v ?? null),
});
export const alterarItemBody = algumCampo(z.strictObject(Object.fromEntries(Object.entries(itemCampos).map(([k, v]) => [k, v.optional()]))));

// ---------------------------------------------------------------- interesses
export const listarInteressesQuery = z.strictObject({ status: z.enum(['novo', 'repassado']).optional() });
export const alterarInteresseBody = z.strictObject({ status: z.enum(['novo', 'repassado']) });
