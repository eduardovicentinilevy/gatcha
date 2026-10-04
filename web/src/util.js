import { CONFIG } from './config.js';

const formatadorReais = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
export const reais = (centavos) => formatadorReais.format(centavos / 100);

const fmtSemana = new Intl.DateTimeFormat('pt-BR', { weekday: 'short', timeZone: 'UTC' });
const fmtMes = new Intl.DateTimeFormat('pt-BR', { month: 'short', timeZone: 'UTC' });
const fmtLongo = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });
const semPonto = (s) => s.replace('.', '');
const dataUTC = (iso) => new Date(`${iso}T12:00:00Z`);

export const rotuloDia = (iso) => {
  const d = dataUTC(iso);
  return { semana: semPonto(fmtSemana.format(d)), numero: d.getUTCDate(), mes: semPonto(fmtMes.format(d)), longo: fmtLongo.format(d) };
};

/** "Hoje" no fuso do café, independente do fuso do aparelho do cliente. */
function hojeNoCafe() {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', { timeZone: CONFIG.fuso, year: 'numeric', month: '2-digit', day: '2-digit' })
      .formatToParts(new Date())
      .map(({ type, value }) => [type, value]),
  );
  return `${p.year}-${p.month}-${p.day}`;
}

export function proximosDias() {
  const base = dataUTC(hojeNoCafe());
  return Array.from({ length: CONFIG.antecedenciaMaxDias + 1 }, (_, i) => {
    const d = new Date(base);
    d.setUTCDate(d.getUTCDate() + i);
    return d.toISOString().slice(0, 10);
  });
}

/** Mesma normalização da API: só dígitos, sem o +55. */
export function normalizarTelefone(valor) {
  const d = valor.replace(/\D/g, '');
  return d.length >= 12 && d.startsWith('55') ? d.slice(2) : d;
}

export const RE_NOME = /^\p{L}[\p{L}\p{M}' .-]*$/u;

export function idade(meses) {
  if (meses == null) return null;
  if (meses < 12) return meses === 1 ? '1 mês' : `${meses} meses`;
  const anos = Math.floor(meses / 12);
  return anos === 1 ? '1 ano' : `${anos} anos`;
}

/** Foca o primeiro campo com erro, na ordem do formulário. */
export function focarPrimeiroErro(form, erros) {
  const campo = [...form.elements].find((c) => c.name && erros[c.name]);
  campo?.focus();
}
