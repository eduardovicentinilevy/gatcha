/**
 * Service: regras de negócio da agenda do gatil. Não conhece HTTP (req/res)
 * nem SQL — orquestra o domínio puro (disponibilidade.js) e o Repository,
 * e define o escopo transacional.
 */
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { config } from '../../config/env.js';
import { pool } from '../../db/pool.js';
import { comTransacao } from '../../db/transacao.js';
import { conflito, naoEncontrado, requisicaoInvalida } from '../../lib/erros.js';
import { enviarEmail } from '../../lib/email.js';
import { logger, serializarErro } from '../../lib/logger.js';
import { gerarCodigoReserva } from '../../lib/codigo-reserva.js';
import { agoraNoFuso, diaDaSemana, parseHora, somarDias } from '../../lib/tempo.js';
import { mapearOcupacao, montarGrade, vagasLivres } from './disponibilidade.js';
import { montarEmailConfirmacao } from './reservas.email.js';
import * as repo from './reservas.repository.js';

const { gatil } = config;
const MAX_TENTATIVAS_CODIGO = 5;

/** Regra: sem datas no passado e antecedência máxima de N dias (14 na v1). */
function garantirDataNoPeriodo(data, agora) {
  const limite = somarDias(agora.data, gatil.antecedenciaMaxDias);
  // Comparação lexicográfica é segura para o formato AAAA-MM-DD.
  if (data < agora.data || data > limite) {
    throw requisicaoInvalida(
      'DATA_FORA_DO_PERIODO',
      `Escolha uma data entre hoje e os próximos ${gatil.antecedenciaMaxDias} dias.`,
      { de: agora.data, ate: limite },
    );
  }
}

const estaAberto = (data) => gatil.diasAbertos.has(diaDaSemana(data));

/**
 * GET /api/horarios — grade do dia com vagas livres para 15 e 30 minutos.
 * Leitura sem transação explícita: é informativa; a garantia forte acontece no POST.
 */
export async function consultarHorarios(data, { agora = agoraNoFuso(gatil.fuso) } = {}) {
  garantirDataNoPeriodo(data, agora);

  if (!estaAberto(data)) {
    return { data, aberto: false, capacidade: gatil.capacidade, horarios: [] };
  }

  const { reservas, bloqueios } = await repo.buscarAgendaDoDia(pool, data);
  const horarios = montarGrade({
    janelas: gatil.janelas,
    capacidade: gatil.capacidade,
    reservas,
    bloqueios,
    aposMinuto: data === agora.data ? agora.minutos : -1,
  });
  return { data, aberto: true, capacidade: gatil.capacidade, horarios };
}

/**
 * POST /api/reservas — cria a reserva garantindo que a capacidade nunca é excedida.
 *
 * Estratégia anti-race-condition (a "Regra de Ouro"):
 *   1. Validações baratas e sem banco ANTES de abrir transação (não seguram conexão à toa).
 *   2. BEGIN (READ COMMITTED)
 *   3. pg_advisory_xact_lock(data)  -> requisições concorrentes para o MESMO DIA fazem fila aqui.
 *   4. Lê a ocupação do dia. Em READ COMMITTED cada instrução enxerga tudo que foi
 *      commitado ANTES dela; como só seguimos após obter o lock, enxergamos
 *      inclusive a reserva que quem estava na nossa frente acabou de gravar.
 *   5. Confere as vagas com a mesma função usada pela grade pública.
 *   6. INSERT e COMMIT (o COMMIT libera o lock para o próximo da fila).
 *
 * Por que não só SERIALIZABLE? Funcionaria, mas o perdedor recebe erro 40001
 * e precisaria de retry; com o lock por data a fila é determinística, curta e
 * sem retry — e o paralelismo entre datas diferentes é preservado.
 */
export async function criarReserva(dados, { agora = agoraNoFuso(gatil.fuso) } = {}) {
  const inicio = parseHora(dados.hora_inicio);

  garantirDataNoPeriodo(dados.data, agora);
  if (!estaAberto(dados.data)) {
    throw requisicaoInvalida('DIA_FECHADO', 'O gatil não funciona nesta data.');
  }
  if (!gatil.janelas.some((j) => inicio >= j.inicio && inicio + dados.duracao_min <= j.fim)) {
    throw requisicaoInvalida('HORARIO_FORA_DO_FUNCIONAMENTO', 'Este horário está fora do funcionamento do gatil.');
  }
  if (dados.data === agora.data && inicio <= agora.minutos) {
    throw requisicaoInvalida('HORARIO_NO_PASSADO', 'Este horário já passou. Escolha um horário futuro.');
  }

  // Token do link de cancelamento: 192 bits aleatórios. Só o hash vai para o banco.
  const token = randomBytes(24).toString('base64url');
  const tokenHash = hashDoToken(token);

  const reserva = await comTransacao(async (client) => {
    // Ordem dos locks é fixa em todas as transações: contato, depois data (sem deadlock).
    await repo.travarContato(client, dados);
    await repo.travarAgendaDoDia(client, dados.data);

    const ativas = await repo.contarReservasAtivasDoContato(client, {
      email: dados.email,
      telefone: dados.telefone,
      aPartirDe: agora.data,
    });
    if (ativas >= gatil.maxReservasAtivasPorContato) {
      throw conflito(
        'LIMITE_DE_RESERVAS_ATIVAS',
        `Limite de ${gatil.maxReservasAtivasPorContato} reservas ativas por contato atingido.`,
      );
    }

    const { reservas, bloqueios } = await repo.buscarAgendaDoDia(client, dados.data);
    const ocupacao = mapearOcupacao(gatil.janelas, reservas, bloqueios);
    const { vagas, motivo } = vagasLivres({
      inicio,
      duracao: dados.duracao_min,
      janelas: gatil.janelas,
      ocupacao,
      capacidade: gatil.capacidade,
    });

    if (motivo === 'BLOQUEADO') {
      throw conflito('HORARIO_BLOQUEADO', 'Este horário foi bloqueado pela equipe. Escolha outro horário.');
    }
    if (vagas < dados.pessoas) {
      throw conflito('VAGAS_INSUFICIENTES', 'Não há vagas suficientes neste horário.', { vagas_disponiveis: vagas });
    }

    for (let tentativa = 1; tentativa <= MAX_TENTATIVAS_CODIGO; tentativa++) {
      const criada = await repo.inserirReserva(client, { ...dados, codigo: gerarCodigoReserva(), tokenHash });
      if (criada) return criada;
    }
    // Probabilidade astronômica com 31^6 combinações; se acontecer, é bug ou ataque.
    throw new Error('Não foi possível gerar um código de reserva único');
  });

  // Depois do COMMIT e sem esperar: e-mail lento ou fora do ar não pode derrubar uma reserva já confirmada.
  // Sem dados pessoais no log (LGPD): só o código da reserva.
  enviarEmail({ para: dados.email, ...montarEmailConfirmacao({ reserva, token }) }).catch((err) =>
    logger.error('Falha ao enviar o e-mail de confirmação', { reserva: reserva.codigo, erro: serializarErro(err) }),
  );
  return reserva;
}

const hashDoToken = (token) => createHash('sha256').update(token).digest('hex');
const HASH_FALSO = hashDoToken('token-inexistente');

/** Minutos desde um marco fixo para uma data AAAA-MM-DD + minutos do dia (comparar instantes no fuso do negócio). */
const minutosAbsolutos = (data, minutos) => Date.parse(`${data}T00:00:00Z`) / 60_000 + minutos;

/**
 * DELETE /api/reservas/:codigo — cancelamento pelo link do e-mail.
 * O token é a credencial: código ou token errado dão a MESMA resposta 404 (não revela quais
 * códigos existem) e a comparação é em tempo constante. Só reservas confirmadas e dentro do prazo.
 */
export async function cancelarReserva({ codigo, token }, { agora = agoraNoFuso(gatil.fuso) } = {}) {
  const reserva = await repo.buscarParaCancelamento(pool, codigo);
  const esperado = Buffer.from(reserva?.token_cancelamento_hash ?? HASH_FALSO, 'hex');
  const informado = Buffer.from(hashDoToken(token), 'hex');
  if (!reserva?.token_cancelamento_hash || !timingSafeEqual(esperado, informado)) {
    throw naoEncontrado('Reserva não encontrada ou link inválido.');
  }

  if (reserva.status !== 'confirmada') {
    throw conflito(
      'RESERVA_NAO_ATIVA',
      reserva.status === 'cancelada' ? 'Essa reserva já foi cancelada.' : 'Essa reserva já foi concluída.',
    );
  }

  const horas = gatil.cancelamentoAteHorasAntes;
  const faltam = minutosAbsolutos(reserva.data, parseHora(reserva.hora_inicio)) - minutosAbsolutos(agora.data, agora.minutos);
  if (faltam < horas * 60) {
    throw conflito(
      'FORA_DO_PRAZO_DE_CANCELAMENTO',
      horas === 0
        ? 'Essa reserva já começou, então não dá mais pra cancelar pelo site.'
        : `O cancelamento pelo site vai até ${horas} ${horas === 1 ? 'hora' : 'horas'} antes do horário. Fala com a gente pelo Instagram.`,
    );
  }

  const cancelada = await repo.cancelarReserva(pool, codigo);
  if (!cancelada) throw conflito('RESERVA_NAO_ATIVA', 'Essa reserva já foi cancelada.'); // outro clique chegou antes
  return cancelada;
}
