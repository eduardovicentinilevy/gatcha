/**
 * Utilitários de data/hora SEM dependências externas.
 *
 * Convenções do domínio:
 *  - Datas de calendário são strings ISO "AAAA-MM-DD" (nunca objetos Date, para
 *    não haver deslocamento de fuso ao serializar).
 *  - Horários do dia são inteiros em MINUTOS desde 00:00 (ex.: 14:30 -> 870).
 *    Aritmética de intervalos fica trivial e sem bugs de fuso.
 */

const RE_DATA = /^(\d{4})-(\d{2})-(\d{2})$/;
const RE_HORA = /^([01]\d|2[0-3]):([0-5]\d)$/;

/** "14:30" -> 870 ; retorna null se o formato for inválido. */
export function parseHora(hhmm) {
  const m = RE_HORA.exec(hhmm);
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

/** 870 -> "14:30" */
export function formatarHora(minutos) {
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** true se "AAAA-MM-DD" existe no calendário (rejeita 2026-02-30). */
export function isDataValida(iso) {
  const m = RE_DATA.exec(iso);
  if (!m) return false;
  const [ano, mes, dia] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const d = new Date(Date.UTC(ano, mes - 1, dia));
  return d.getUTCFullYear() === ano && d.getUTCMonth() === mes - 1 && d.getUTCDate() === dia;
}

/** 0 = domingo ... 6 = sábado (o dia da semana de uma data de calendário independe de fuso). */
export function diaDaSemana(iso) {
  const [a, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(a, m - 1, d)).getUTCDay();
}

/** somarDias("2026-10-31", 1) -> "2026-11-01" */
export function somarDias(iso, dias) {
  const [a, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(a, m - 1, d + dias)).toISOString().slice(0, 10);
}

const formatadores = new Map();

/**
 * "Agora" no fuso do negócio, independente do fuso do servidor
 * (Cloud Run roda em UTC; o gatil funciona em America/Sao_Paulo).
 * @returns {{ data: string, minutos: number }}
 */
export function agoraNoFuso(fuso, instante = new Date()) {
  let fmt = formatadores.get(fuso);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat('en-CA', {
      timeZone: fuso,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    });
    formatadores.set(fuso, fmt);
  }
  const p = Object.fromEntries(fmt.formatToParts(instante).map(({ type, value }) => [type, value]));
  return { data: `${p.year}-${p.month}-${p.day}`, minutos: Number(p.hour) * 60 + Number(p.minute) };
}
