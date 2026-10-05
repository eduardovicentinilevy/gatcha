/**
 * Login do painel.
 *
 * Defesas contra força bruta e enumeração de usuários:
 *  1. Limite por IP na rota (middleware).
 *  2. Limite por E-MAIL no banco (vale em todas as instâncias do Cloud Run):
 *     após N falhas em 15 min, bloqueia — inclusive para e-mails que não existem,
 *     para não revelar quais existem.
 *  3. Mesma resposta e mesmo tempo para "e-mail inexistente" e "senha errada".
 *  4. Falhas e sucessos ficam no log de acessos (sem a senha).
 */
import { config } from '../../config/env.js';
import { comTransacao } from '../../db/transacao.js';
import { AppError } from '../../lib/erros.js';
import * as repo from './auth.repository.js';
import { conferirSenha, gastarTempoDeConferencia } from './senha.js';
import { emitirToken, loginConfigurado } from './token.js';

const JANELA_BLOQUEIO_MIN = 15;

const credenciaisInvalidas = () => new AppError(401, 'CREDENCIAIS_INVALIDAS', 'E-mail ou senha incorretos.');

export async function entrar({ email, senha }, { ip } = {}) {
  if (!loginConfigurado()) {
    throw new AppError(503, 'LOGIN_INDISPONIVEL', 'O login do painel ainda não foi configurado.');
  }

  // ATENÇÃO: o resultado (e o log da falha) precisa ser CONFIRMADO no banco antes de
  // lançar o erro. Lançar dentro da transação faria ROLLBACK e as falhas nunca seriam
  // gravadas, desativando o bloqueio por força bruta.
  const resultado = await comTransacao(async (client) => {
    await repo.travarLogin(client, email);

    const falhas = await repo.contarFalhasRecentes(client, email, JANELA_BLOQUEIO_MIN);
    if (falhas >= config.auth.maxFalhasPorEmail) {
      await repo.registrarAcesso(client, { email, evento: 'login_falha', rota: '/api/auth/login', status: 429, ip });
      return { erro: new AppError(429, 'MUITAS_TENTATIVAS', `Muitas tentativas. Aguarde ${JANELA_BLOQUEIO_MIN} minutos e tente de novo.`) };
    }

    const usuario = await repo.buscarUsuarioPorEmail(client, email);
    const confere = usuario ? await conferirSenha(senha, usuario.senha_hash) : (await gastarTempoDeConferencia(senha), false);

    if (!confere) {
      await repo.registrarAcesso(client, { usuarioId: usuario?.id ?? null, email, evento: 'login_falha', rota: '/api/auth/login', status: 401, ip });
      return { erro: credenciaisInvalidas() };
    }

    await repo.registrarAcesso(client, { usuarioId: usuario.id, email, evento: 'login_ok', rota: '/api/auth/login', status: 200, ip });
    return { usuario };
  });

  if (resultado.erro) throw resultado.erro;
  const { token, expiraEm } = await emitirToken(resultado.usuario.id);
  return { token, expira_em: expiraEm, usuario: { email: resultado.usuario.email } };
}
