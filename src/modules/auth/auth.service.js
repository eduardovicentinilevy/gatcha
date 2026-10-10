/**
 * Login do painel.
 *
 * Defesas contra força bruta e enumeração de usuários:
 *  1. Limite por IP na rota (middleware; só tentativas que FALHAM contam).
 *  2. Limite no banco (vale em todas as instâncias do Cloud Run), por e-mail + IP
 *     (5 falhas/15 min) e por e-mail somando todos os IPs (30). Assim quem erra a
 *     senha DE PROPÓSITO, de outro IP, não tranca a conta da equipe, e um ataque
 *     distribuído ainda esbarra no limite global. Vale também para e-mails que não
 *     existem, para não revelar quais existem. Tentativas bloqueadas não contam.
 *  3. Mesma resposta e mesmo tempo para "e-mail inexistente", "senha errada" e
 *     "código do 2FA errado ou faltando": a resposta nunca diz que a senha estava certa.
 *  4. Falhas e sucessos ficam no log de acessos (sem a senha).
 *  5. 2FA opcional por pessoa (app autenticador), no MESMO envio da senha. O código é
 *     conferido sob a trava por e-mail (tentativas simultâneas não furam os limites) e
 *     tem um limite próprio de 10 erros por 24 h, que só zera trocando a senha ou
 *     reativando o 2FA: quem descobriu a senha não chuta códigos indefinidamente.
 */
import { config } from '../../config/env.js';
import { pool } from '../../db/pool.js';
import { comTransacao } from '../../db/transacao.js';
import { AppError } from '../../lib/erros.js';
import { logger, serializarErro } from '../../lib/logger.js';
import * as repo from './auth.repository.js';
import { comLimiteDeConferencias, conferirSenha, gastarTempoDeConferencia } from './senha.js';
import { emitirToken, loginConfigurado } from './token.js';
import { conferirCodigo, decifrarSegredo } from './totp.js';

const JANELA_BLOQUEIO_MIN = 15;
const MAX_FALHAS_2FA_POR_DIA = 10; // até 10 chutes por dia, cada um com ~3 em 1 milhão de chance (tolerância de relógio)

export const credenciaisInvalidas = () => new AppError(401, 'CREDENCIAIS_INVALIDAS', 'E-mail, senha ou código incorretos.');
const muitasTentativas = (quando) => new AppError(429, 'MUITAS_TENTATIVAS', `Muitas tentativas. ${quando}`);

/** Login: confere e-mail, senha e (se ativado) o código do 2FA; devolve um token de sessão curta. */
export async function entrar(credenciais, { ip } = {}) {
  const { usuario, tentativaId } = await verificarCredenciais(credenciais, { ip, rota: '/api/auth/login' });
  await repo.confirmarLogin(pool, { id: tentativaId, usuarioId: usuario.id });
  const { token, expiraEm } = await emitirToken(usuario.id);
  return { token, expira_em: expiraEm, usuario: { email: usuario.email, dois_fatores: Boolean(usuario.totp_segredo) } };
}

/**
 * Confere as credenciais com todas as defesas do login. A tentativa fica gravada como
 * FALHA até quem chamou confirmar o sucesso (repo.confirmarLogin): se algo lançar erro
 * no meio do caminho, ela continua contando.
 * @returns {Promise<{ usuario: object, tentativaId: number }>}
 */
export async function verificarCredenciais({ email, senha, codigo }, { ip, rota }) {
  if (!loginConfigurado()) {
    throw new AppError(503, 'LOGIN_INDISPONIVEL', 'O login do painel ainda não foi configurado: defina JWT_SECRET no servidor (em desenvolvimento, rode npm run dev de novo que ele é gerado).');
  }

  // Fase 1 (curta, com lock por e-mail): confere o bloqueio e RESERVA a tentativa
  // (já contada como falha). Não lança erro aqui dentro: um throw faria ROLLBACK e
  // as falhas nunca seriam gravadas, desativando o bloqueio.
  const fase1 = await comTransacao(async (client) => {
    await repo.travarLogin(client, email);

    const falhas = await repo.contarFalhasRecentes(client, email, ip, JANELA_BLOQUEIO_MIN);
    if (falhas.porIp >= config.auth.maxFalhasPorEmail || falhas.global >= config.auth.maxFalhasGlobalPorEmail) {
      // Registrada, mas com status 429: não conta como falha (não prolonga o bloqueio).
      await repo.registrarAcesso(client, { email, evento: 'login_falha', rota, status: 429, ip });
      return { bloqueado: true };
    }

    const usuario = await repo.buscarUsuarioPorEmail(client, email);
    const tentativaId = await repo.reservarTentativa(client, { usuarioId: usuario?.id ?? null, email, ip, rota });
    return { usuario, tentativaId };
  });

  if (fase1.bloqueado) throw muitasTentativas(`Aguarde ${JANELA_BLOQUEIO_MIN} minutos e tente de novo.`);

  // Fase 2: bcrypt FORA da transação (sem conexão do pool presa) e com concorrência limitada.
  const { usuario, tentativaId } = fase1;
  const confere = await comLimiteDeConferencias(async () =>
    usuario ? conferirSenha(senha, usuario.senha_hash) : (await gastarTempoDeConferencia(senha), false),
  );

  // Fase 3: o código do 2FA é rápido de conferir, então roda SOB a trava do e-mail: contar,
  // conferir e gravar o resultado acontecem juntos, sem brecha para tentativas paralelas.
  // Roda em TODA tentativa (senha certa ou errada, com ou sem 2FA), com o mesmo trabalho
  // no banco: o tempo de resposta não revela se a senha estava certa.
  const resultado = await comTransacao((client) => conferirSegundoFator(client, { email, usuario, senhaConfere: confere, codigo, tentativaId }));
  if (!confere) throw credenciaisInvalidas(); // a tentativa já está gravada como falha
  if (resultado.erro) throw resultado.erro; // fora da transação: o que foi gravado nela fica
  return { usuario, tentativaId };
}

/** Devolve { erro } em vez de lançar: um throw desfaria o registro da falha. */
async function conferirSegundoFator(client, { email, usuario, senhaConfere, codigo, tentativaId }) {
  await repo.travarLogin(client, email);
  const atual = usuario ? await repo.buscarEstado2fa(client, { id: usuario.id }) : null; // lido sob a trava: nada de valor velho
  const falhas2fa = await repo.contarFalhas2fa(client, { email });
  if (!senhaConfere || !atual?.totp_segredo) return {}; // sem 2FA (ou senha errada): mesmo trabalho, nada a conferir

  if (falhas2fa >= MAX_FALHAS_2FA_POR_DIA) {
    await repo.marcarTentativa(client, { id: tentativaId, status: 429 }); // bloqueada: não conta como falha
    return { erro: muitasTentativas('Tente de novo mais tarde. Se não foi você, troque a senha.') };
  }

  let segredo;
  try {
    segredo = decifrarSegredo(atual.totp_segredo, usuario.id);
  } catch (err) {
    logger.error('Não deu pra ler o segredo do 2FA (a CHAVE_DADOS mudou?). Desative com: npm run admin:2fa -- <email> --desativar', { usuario_id: usuario.id, erro: serializarErro(err) });
    await repo.marcarTentativa(client, { id: tentativaId, status: 503 }); // problema do servidor: não conta como falha
    return { erro: new AppError(503, 'DOIS_FATORES_INDISPONIVEL', 'Não deu pra conferir o código agora. Avise quem administra o sistema.') };
  }

  const passo = conferirCodigo(segredo, codigo ?? '', { ultimoPasso: atual.totp_ultimo_passo });
  if (passo === null) {
    await repo.marcarFalha2fa(client, { id: tentativaId });
    return { erro: credenciaisInvalidas() };
  }
  await repo.registrarPasso2fa(client, { id: usuario.id, passo }); // sob a trava: o mesmo código não vale duas vezes
  return {};
}
