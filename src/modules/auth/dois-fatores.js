/**
 * 2FA pelo próprio painel: cada pessoa logada ativa ou desativa o dela.
 *
 * - O segredo é gerado e cifrado PELO SERVIDOR, com a chave dele: não existe o risco de
 *   cadastrar com uma chave diferente da de produção.
 * - Ativar pede a senha e um código do app (prova que o celular foi cadastrado certo).
 *   Desativar pede a senha E um código: quem pegou uma sessão aberta emprestada não
 *   consegue nem trancar a conta com um 2FA dele nem tirar a proteção.
 * - A senha passa pelas mesmas defesas do login (bloqueio por e-mail + IP, log de acessos).
 * - Ativar ou desativar encerra as outras sessões; esta recebe um token novo.
 */
import { pool } from '../../db/pool.js';
import { AppError, conflito } from '../../lib/erros.js';
import * as repo from './auth.repository.js';
import { verificarCredenciais } from './auth.service.js';
import { emitirToken } from './token.js';
import { cifrarSegredo, conferirCodigo, decifrarSegredo, gerarSegredo, linkOtpauth, paraBase32 } from './totp.js';

const VALIDADE_PENDENTE_MIN = 15;

const jaAtivo = () => conflito('DOIS_FATORES_JA_ATIVO', 'A verificação em duas etapas já está ativa nesta conta.');

/** Passo 1: gera o segredo (pendente) e devolve o que a pessoa cadastra no app. */
export async function iniciarAtivacao(admin) {
  if (admin.dois_fatores) throw jaAtivo();
  const segredo = gerarSegredo();
  await repo.definirPendente2fa(pool, { id: admin.id, pendenteCifrado: cifrarSegredo(segredo, admin.id) });
  const chave = paraBase32(segredo);
  return { chave, link: linkOtpauth({ chave, email: admin.email }), validade_minutos: VALIDADE_PENDENTE_MIN };
}

/** Passo 2: confere o código do app e a senha; o 2FA passa a valer no login. */
export async function confirmarAtivacao(admin, { senha, codigo }, { ip }) {
  if (admin.dois_fatores) throw jaAtivo();
  const expirada = () => conflito('ATIVACAO_EXPIRADA', 'A ativação expirou. Comece de novo para gerar outro QR code.');
  const pendente = await repo.buscarPendente2fa(pool, { id: admin.id, minutos: VALIDADE_PENDENTE_MIN });
  if (!pendente) throw expirada();
  let segredo;
  try {
    segredo = decifrarSegredo(pendente, admin.id);
  } catch {
    throw expirada(); // ex.: a CHAVE_DADOS do servidor mudou no meio da ativação
  }

  // O código primeiro (é barato e não diz nada sobre a senha): um erro de digitação não custa uma tentativa de senha.
  const passo = conferirCodigo(segredo, codigo);
  if (passo === null) {
    throw new AppError(422, 'CODIGO_2FA_INVALIDO', 'O código não confere. Confira se digitou o código atual da conta "Gatchá" no app e se o relógio do celular está certo.');
  }
  const { tentativaId } = await verificarCredenciais({ email: admin.email, senha }, { ip, rota: '/api/admin/2fa/ativar' });
  await repo.confirmarLogin(pool, { id: tentativaId, usuarioId: admin.id });
  const alteradoEm = await repo.definirSegredo2fa(pool, { id: admin.id, segredoCifrado: pendente, ultimoPasso: passo });
  return novaSessao(admin, alteradoEm, true);
}

/** Desativa com senha + código atual (celular trocado: desative e ative de novo). */
export async function desativar(admin, { senha, codigo }, { ip }) {
  if (!admin.dois_fatores) throw conflito('DOIS_FATORES_INATIVO', 'A verificação em duas etapas não está ativa nesta conta.');
  const { tentativaId } = await verificarCredenciais({ email: admin.email, senha, codigo }, { ip, rota: '/api/admin/2fa/desativar' });
  await repo.confirmarLogin(pool, { id: tentativaId, usuarioId: admin.id });
  const alteradoEm = await repo.definirSegredo2fa(pool, { id: admin.id, segredoCifrado: null });
  return novaSessao(admin, alteradoEm, false);
}

/** O token novo é emitido no mesmo segundo (ou depois) da mudança que encerrou as sessões antigas. */
async function novaSessao(admin, alteradoEm, doisFatores) {
  const agora = new Date(Math.max(Date.now(), new Date(alteradoEm).getTime()));
  const { token, expiraEm } = await emitirToken(admin.id, { agora });
  return { token, expira_em: expiraEm, usuario: { email: admin.email, dois_fatores: doisFatores } };
}
