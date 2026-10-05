/**
 * Service: regras de negócio da agenda do gatil. Não conhece HTTP (req/res)
 * nem SQL — orquestra o domínio puro (disponibilidade.js) e o Repository,
 * e define o escopo transacional.
 */
import { config } from '../../config/env.js';
import { pool } from '../../db/pool.js';
import { comTransacao } from '../../db/transacao.js';
import { conflito, requisicaoInvalida } from '../../lib/erros.js';
import { gerarCodigoReserva } from '../../lib/codigo-reserva.js';
import { agoraNoFuso, diaDaSemana, parseHora, somarDias } from '../../lib/tempo.js';
import { mapearOcupacao, montarGrade, vagasLivres } from './disponibilidade.js';
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

  return comTransacao(async (client) => {
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
      const reserva = await repo.inserirReserva(client, { ...dados, codigo: gerarCodigoReserva() });
      if (reserva) return reserva;
    }
    // Probabilidade astronômica com 31^6 combinações; se acontecer, é bug ou ataque.
    throw new Error('Não foi possível gerar um código de reserva único');
  });
}
