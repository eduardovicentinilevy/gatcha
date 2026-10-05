import { CONFIG } from './config.js';

const formatadorReais = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
export const reais = (centavos) => formatadorReais.format(centavos / 100);

const fmtSemana = new Intl.DateTimeFormat('pt-BR', { weekday: 'short', timeZone: 'UTC' });
const fmtMes = new Intl.DateTimeFormat('pt-BR', { month: 'long', timeZone: 'UTC' });
const fmtLongo = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });
const fmtCurto = new Intl.DateTimeFormat('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit', timeZone: 'UTC' });
const semPonto = (s) => s.replace('.', '');
export const dataUTC = (iso) => new Date(`${iso}T12:00:00Z`);

export const rotuloDia = (iso) => {
  const d = dataUTC(iso);
  return {
    semana: semPonto(fmtSemana.format(d)),
    numero: d.getUTCDate(),
    mes: fmtMes.format(d),
    longo: fmtLongo.format(d),
    curto: semPonto(fmtCurto.format(d)),
  };
};

export const diaDaSemana = (iso) => dataUTC(iso).getUTCDay();

/** "Agora" no fuso do café, independente do fuso do aparelho do cliente. */
export function agoraNoCafe() {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: CONFIG.gatil.fuso, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    })
      .formatToParts(new Date())
      .map(({ type, value }) => [type, value]),
  );
  return { data: `${p.year}-${p.month}-${p.day}`, minutos: Number(p.hour) * 60 + Number(p.minute) };
}

/** Hoje + os próximos N dias (N = antecedência máxima), em AAAA-MM-DD. */
export function proximosDias() {
  const base = dataUTC(agoraNoCafe().data);
  return Array.from({ length: CONFIG.gatil.antecedenciaMaxDias + 1 }, (_, i) => {
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

/** Máscara de telefone brasileiro: (11) 91234-5678 ou (11) 3123-4567. */
export function mascararTelefone(valor) {
  const d = normalizarTelefone(valor).slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : '';
  const ddd = d.slice(0, 2);
  const resto = d.slice(2);
  if (resto.length <= 4) return `(${ddd}) ${resto}`;
  const corte = resto.length === 9 ? 5 : 4;
  return `(${ddd}) ${resto.slice(0, corte)}-${resto.slice(corte)}`;
}

export const RE_NOME = /^\p{L}[\p{L}\p{M}' .-]*$/u;
export const RE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function idade(meses) {
  if (meses == null) return null;
  if (meses < 12) return meses === 1 ? '1 mês' : `${meses} meses`;
  const anos = Math.floor(meses / 12);
  return anos === 1 ? '1 ano' : `${anos} anos`;
}

/** Busca sem acento e sem diferenciar maiúsculas. */
export const normalizarBusca = (s) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim();

/** Foca o primeiro campo com erro, na ordem do formulário. */
export function focarPrimeiroErro(form, erros) {
  const campo = [...form.elements].find((c) => c.name && erros[c.name]);
  campo?.focus();
}

export const reduzirMovimento = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** "Aberto agora" ou "Fechado agora", pelo horário do café (fuso de São Paulo). */
export function cafeAberto() {
  const { data, minutos } = agoraNoCafe();
  const [ha, ma] = CONFIG.horarioCafe.abre.split(':').map(Number);
  const [hf, mf] = CONFIG.horarioCafe.fecha.split(':').map(Number);
  return CONFIG.gatil.diasAbertos.includes(diaDaSemana(data)) && minutos >= ha * 60 + ma && minutos < hf * 60 + mf;
}
