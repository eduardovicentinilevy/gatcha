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
 *  3. Mesma resposta e mesmo tempo para "e-mail inexistente" e "senha errada".
 *  4. Falhas e sucessos ficam no log de acessos (sem a senha).
 */
import { config } from '../../config/env.js';
import { pool } from '../../db/pool.js';
import { comTransacao } from '../../db/transacao.js';
import { AppError } from '../../lib/erros.js';
import * as repo from './auth.repository.js';
import { comLimiteDeConferencias, conferirSenha, gastarTempoDeConferencia } from './senha.js';
import { emitirToken, loginConfigurado } from './token.js';

const JANELA_BLOQUEIO_MIN = 15;

export const credenciaisInvalidas = () => new AppError(401, 'CREDENCIAIS_INVALIDAS', 'E-mail ou senha incorretos.');
const muitasTentativas = (quando) => new AppError(429, 'MUITAS_TENTATIVAS', `Muitas tentativas. ${quando}`);

/** Login: confere e-mail e senha; devolve um token de sessão curta. */
export async function entrar({ email, senha }, { ip } = {}) {
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
      await repo.registrarAcesso(client, { email, evento: 'login_falha', rota: '/api/auth/login', status: 429, ip });
      return { bloqueado: true };
    }

    const usuario = await repo.buscarUsuarioPorEmail(client, email);
    const tentativaId = await repo.reservarTentativa(client, { usuarioId: usuario?.id ?? null, email, ip });
    return { usuario, tentativaId };
  });

  if (fase1.bloqueado) throw muitasTentativas(`Aguarde ${JANELA_BLOQUEIO_MIN} minutos e tente de novo.`);

  // Fase 2: bcrypt FORA da transação (sem conexão do pool presa) e com concorrência limitada.
  const { usuario, tentativaId } = fase1;
  const confere = await comLimiteDeConferencias(async () =>
    usuario ? conferirSenha(senha, usuario.senha_hash) : (await gastarTempoDeConferencia(senha), false),
  );
  if (!confere) throw credenciaisInvalidas(); // a tentativa já está gravada como falha

  await repo.confirmarLogin(pool, { id: tentativaId, usuarioId: usuario.id });
  const { token, expiraEm } = await emitirToken(usuario.id);
  return { token, expira_em: expiraEm, usuario: { email: usuario.email } };
}
