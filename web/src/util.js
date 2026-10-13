import { CONFIG } from './config.js';

const formatadorReais = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
export const reais = (centavos) => formatadorReais.format(centavos / 100);

export const dataUTC = (iso) => new Date(`${iso}T12:00:00Z`);

export const diaDaSemana = (iso) => dataUTC(iso).getUTCDay();

/** "Agora" no fuso do café, independente do fuso do aparelho do cliente. */
let fmtAgora; // criar Intl.DateTimeFormat é caro: um só, reaproveitado
export function agoraNoCafe() {
  fmtAgora ??= new Intl.DateTimeFormat('en-CA', {
    timeZone: CONFIG.gatil.fuso, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  });
  const p = Object.fromEntries(
    fmtAgora
      .formatToParts(new Date())
      .map(({ type, value }) => [type, value]),
  );
  return { data: `${p.year}-${p.month}-${p.day}`, minutos: Number(p.hour) * 60 + Number(p.minute) };
}

export const reduzirMovimento = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** "Aberto agora" ou "Fechado agora", pelo horário do café (fuso de São Paulo). */
export function cafeAberto() {
  const { data, minutos } = agoraNoCafe();
  const [ha, ma] = CONFIG.horarioCafe.abre.split(':').map(Number);
  const [hf, mf] = CONFIG.horarioCafe.fecha.split(':').map(Number);
  return CONFIG.gatil.diasAbertos.includes(diaDaSemana(data)) && minutos >= ha * 60 + ma && minutos < hf * 60 + mf;
}
