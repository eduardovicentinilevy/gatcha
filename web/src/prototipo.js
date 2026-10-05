/**
 * Simulação do backend para o protótipo navegável (CONFIG.modoPrototipo).
 * Lê o "dia típico" de /dados-exemplo/horarios.json (formato da API) e aplica
 * as mesmas regras da API: dias fechados, horários passados e vagas por célula
 * de 15 min. As reservas feitas na sessão descontam vagas, para o cliente
 * validar o fluxo completo (inclusive o "esgotou"). Nada é enviado a lugar nenhum.
 */
import { CONFIG } from './config.js';
import { ErroApi, requisitar } from './api.js';
import { agoraNoCafe, diaDaSemana } from './util.js';

const reservasDaSessao = []; // { data, inicio, duracao, pessoas }
let diaTipico;

const paraMinutos = (hhmm) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

async function carregarDiaTipico() {
  diaTipico ??= requisitar(`${CONFIG.dadosExemploBase}/horarios.json`);
  return diaTipico;
}

export async function horarios(data) {
  await esperar(250); // simula rede, para o cliente ver os estados de carregamento
  const base = await carregarDiaTipico();
  if (!CONFIG.gatil.diasAbertos.includes(diaDaSemana(data))) {
    return { data, aberto: false, capacidade: base.capacidade, horarios: [] };
  }

  // vagas de 15 min = sobra de cada célula; desconta as reservas da sessão
  const celulas = base.horarios.map((h) => {
    const inicio = paraMinutos(h.hora_inicio);
    const ocupadasNaSessao = reservasDaSessao
      .filter((r) => r.data === data && r.inicio < inicio + 15 && inicio < r.inicio + r.duracao)
      .reduce((soma, r) => soma + r.pessoas, 0);
    return { hora_inicio: h.hora_inicio, inicio, vagas_15min: Math.max(0, h.vagas_15min - ocupadasNaSessao) };
  });

  // vagas de 30 min = menor sobra entre a célula e a seguinte (se a seguinte existir e for contígua)
  const lista = celulas.map((c, i) => {
    const prox = celulas[i + 1];
    return {
      hora_inicio: c.hora_inicio,
      vagas_15min: c.vagas_15min,
      vagas_30min: prox && prox.inicio === c.inicio + 15 ? Math.min(c.vagas_15min, prox.vagas_15min) : 0,
    };
  });

  const agora = agoraNoCafe();
  const futuros = data === agora.data ? lista.filter((h) => paraMinutos(h.hora_inicio) > agora.minutos) : lista;
  return { data, aberto: true, capacidade: base.capacidade, horarios: futuros };
}

function gerarCodigo() {
  const alfabeto = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
  const aleatorios = crypto.getRandomValues(new Uint32Array(6));
  return `GATCHA-${[...aleatorios].map((n) => alfabeto[n % alfabeto.length]).join('')}`;
}

export async function criarReserva(dados) {
  const grade = await horarios(dados.data);
  await esperar(500);
  const h = grade.horarios.find((x) => x.hora_inicio === dados.hora_inicio);
  const vagas = h ? (dados.duracao_min === 30 ? h.vagas_30min : h.vagas_15min) : 0;
  if (vagas < dados.pessoas) {
    throw new ErroApi(409, 'VAGAS_INSUFICIENTES', 'Eita, essas vagas acabaram de ser reservadas. Escolhe outro horário?', {
      vagas_disponiveis: vagas,
    });
  }
  reservasDaSessao.push({ data: dados.data, inicio: paraMinutos(dados.hora_inicio), duracao: dados.duracao_min, pessoas: dados.pessoas });
  return {
    reserva: {
      codigo: gerarCodigo(),
      data: dados.data,
      hora_inicio: dados.hora_inicio,
      duracao_min: dados.duracao_min,
      pessoas: dados.pessoas,
      nome: dados.nome,
      status: 'confirmada',
    },
  };
}

export async function registrarInteresse() {
  await esperar(500);
  return { ok: true };
}
