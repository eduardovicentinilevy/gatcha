/**
 * Login do painel.
 *
 * Defesas contra força bruta e enumeração de usuários:
 *  1. Limite por IP na rota (middleware).
 *  2. Limite no banco (vale em todas as instâncias do Cloud Run), por e-mail + IP
 *     (5 falhas/15 min) e por e-mail somando todos os IPs (30). Assim quem erra a
 *     senha DE PROPÓSITO, de outro IP, não tranca a conta da equipe, e um ataque
 *     distribuído ainda esbarra no limite global. Vale também para e-mails que não
 *     existem, para não revelar quais existem. Tentativas bloqueadas não contam.
 *  3. Mesma resposta e mesmo tempo para "e-mail inexistente" e "senha errada".
 *  4. Falhas e sucessos ficam no log de acessos (sem a senha).
 *  5. 2FA opcional por usuário (app autenticador). Código errado conta como falha
 *     nos limites acima E num limite diário próprio: quem já tem a senha não pode
 *     ficar chutando códigos indefinidamente.
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

const credenciaisInvalidas = () => new AppError(401, 'CREDENCIAIS_INVALIDAS', 'E-mail ou senha incorretos.');

export async function entrar({ email, senha, codigo }, { ip } = {}) {
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

  if (fase1.bloqueado) {
    throw new AppError(429, 'MUITAS_TENTATIVAS', `Muitas tentativas. Aguarde ${JANELA_BLOQUEIO_MIN} minutos e tente de novo.`);
  }

  // Fase 2: bcrypt FORA da transação (sem conexão do pool presa) e com concorrência limitada.
  const { usuario, tentativaId } = fase1;
  const confere = await comLimiteDeConferencias(async () =>
    usuario ? conferirSenha(senha, usuario.senha_hash) : (await gastarTempoDeConferencia(senha), false),
  );
  if (!confere) throw credenciaisInvalidas(); // a tentativa já está gravada como falha

  if (usuario.totp_segredo) await conferirSegundoFator(usuario, codigo, tentativaId);

  await repo.confirmarLogin(pool, { id: tentativaId, usuarioId: usuario.id });
  const { token, expiraEm } = await emitirToken(usuario.id);
  return { token, expira_em: expiraEm, usuario: { email: usuario.email } };
}

/** Senha já conferida. Lança erro (e a tentativa continua contando como falha) se o código não vale. */
async function conferirSegundoFator(usuario, codigo, tentativaId) {
  if ((await repo.contarFalhas2fa(pool, { usuarioId: usuario.id })) >= MAX_FALHAS_2FA_POR_DIA) {
    throw new AppError(429, 'MUITAS_TENTATIVAS_2FA', 'Código errado vezes demais: o login desta conta está pausado por até 24 horas. Se não foi você, troque a senha.');
  }
  if (!codigo) throw new AppError(401, 'CODIGO_2FA_NECESSARIO', 'Digite o código de 6 dígitos do app autenticador.');

  let segredo;
  try {
    segredo = decifrarSegredo(usuario.totp_segredo, usuario.id);
  } catch (err) {
    logger.error('Não deu pra ler o segredo do 2FA (o JWT_SECRET mudou?). Reative com: npm run admin:2fa -- <email>', { usuario_id: usuario.id, erro: serializarErro(err) });
    throw new AppError(503, 'DOIS_FATORES_INDISPONIVEL', 'Não deu pra conferir o código agora. Avise quem administra o sistema.');
  }

  const passo = conferirCodigo(segredo, codigo, { ultimoPasso: usuario.totp_ultimo_passo });
  // registrarPasso2fa é a trava final contra reuso: dois logins simultâneos com o mesmo código, só um passa.
  if (passo === null || !(await repo.registrarPasso2fa(pool, { id: usuario.id, passo }))) {
    await repo.marcarFalha2fa(pool, { id: tentativaId });
    throw new AppError(401, 'CODIGO_2FA_INVALIDO', 'Código incorreto ou já usado. Confira o app e tente de novo.');
  }
}
