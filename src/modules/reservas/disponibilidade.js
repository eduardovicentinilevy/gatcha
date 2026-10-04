/**
 * Núcleo de domínio da agenda do gatil — funções PURAS (sem banco, sem HTTP,
 * sem relógio). Por isso são testáveis isoladamente e o MESMO cálculo é usado
 * tanto na consulta pública (GET /horarios) quanto dentro da transação que
 * cria a reserva (POST /reservas): a tela nunca promete algo que o POST nega
 * por usar outra regra.
 *
 * Modelo: o dia é dividido em CÉLULAS de 15 minutos. Uma reserva de 30 min
 * ocupa 2 células consecutivas. A vaga de um intervalo é a MENOR sobra de
 * capacidade entre as células que ele cobre.
 *
 * Todos os horários são minutos desde 00:00; intervalos são semiabertos [inicio, fim).
 */
import { formatarHora } from '../../lib/tempo.js';

export const PASSO_MIN = 15;
export const DURACOES_MIN = Object.freeze([15, 30]);

const sobrepoe = (inicioA, fimA, inicioB, fimB) => inicioA < fimB && inicioB < fimA;

/** Inícios de todas as células de 15 min dentro das janelas de funcionamento. */
export function celulasDoDia(janelas) {
  const celulas = [];
  for (const { inicio, fim } of janelas) {
    for (let t = inicio; t + PASSO_MIN <= fim; t += PASSO_MIN) celulas.push(t);
  }
  return celulas;
}

/**
 * Ocupação de cada célula do dia.
 * @param {{inicio:number, fim:number}[]} janelas
 * @param {{inicio:number, fim:number, pessoas:number}[]} reservas  reservas NÃO canceladas
 * @param {{inicio:number, fim:number}[]} bloqueios
 * @returns {Map<number, {ocupadas:number, bloqueada:boolean}>}
 */
export function mapearOcupacao(janelas, reservas, bloqueios) {
  const ocupacao = new Map();
  for (const c of celulasDoDia(janelas)) {
    const fimCelula = c + PASSO_MIN;
    let ocupadas = 0;
    for (const r of reservas) if (sobrepoe(c, fimCelula, r.inicio, r.fim)) ocupadas += r.pessoas;
    const bloqueada = bloqueios.some((b) => sobrepoe(c, fimCelula, b.inicio, b.fim));
    ocupacao.set(c, { ocupadas, bloqueada });
  }
  return ocupacao;
}

/**
 * Vagas livres para o intervalo [inicio, inicio + duracao).
 * O intervalo precisa caber INTEIRO numa única janela (não atravessa a pausa
 * entre janelas nem passa do último horário do dia).
 *
 * @returns {{ vagas: number, motivo: null | 'FORA_DA_JANELA' | 'BLOQUEADO' }}
 */
export function vagasLivres({ inicio, duracao, janelas, ocupacao, capacidade }) {
  const fim = inicio + duracao;
  const cabeNumaJanela = janelas.some((j) => inicio >= j.inicio && fim <= j.fim);
  if (!cabeNumaJanela || inicio % PASSO_MIN !== 0) return { vagas: 0, motivo: 'FORA_DA_JANELA' };

  let vagas = capacidade;
  for (let c = inicio; c < fim; c += PASSO_MIN) {
    const celula = ocupacao.get(c);
    if (!celula) return { vagas: 0, motivo: 'FORA_DA_JANELA' };
    if (celula.bloqueada) return { vagas: 0, motivo: 'BLOQUEADO' };
    vagas = Math.min(vagas, capacidade - celula.ocupadas);
  }
  // max(0, …): se a capacidade for reduzida depois de existirem reservas, não exibimos vaga negativa.
  return { vagas: Math.max(0, vagas), motivo: null };
}

/**
 * Grade pública do dia: um item por horário de início, com as vagas para cada duração.
 * Horários que já começaram (quando a data é hoje) são omitidos.
 *
 * @param {{ janelas, capacidade, reservas, bloqueios, aposMinuto?: number }} p
 *        aposMinuto: só lista inícios estritamente depois deste minuto (-1 = todos)
 */
export function montarGrade({ janelas, capacidade, reservas, bloqueios, aposMinuto = -1 }) {
  const ocupacao = mapearOcupacao(janelas, reservas, bloqueios);
  return celulasDoDia(janelas)
    .filter((inicio) => inicio > aposMinuto)
    .map((inicio) => {
      const vagas = (duracao) => vagasLivres({ inicio, duracao, janelas, ocupacao, capacidade }).vagas;
      return {
        hora_inicio: formatarHora(inicio),
        vagas_15min: vagas(15),
        vagas_30min: vagas(30),
      };
    });
}
