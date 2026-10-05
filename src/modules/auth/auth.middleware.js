/**
 * Protege rotas do painel: exige "Authorization: Bearer <token>" válido E que o
 * usuário ainda exista. Ao responder, grava no log de acessos (quem, método,
 * rota SEM query string, status e IP). Nunca registra corpo, token ou senha.
 */
import { pool } from '../../db/pool.js';
import { AppError } from '../../lib/erros.js';
import { logger, serializarErro } from '../../lib/logger.js';
import * as repo from './auth.repository.js';
import { verificarToken } from './token.js';

const naoAutorizado = () => new AppError(401, 'NAO_AUTENTICADO', 'Entre no painel para continuar.');

export async function exigirAdmin(req, res, next) {
  const cabecalho = req.get('authorization') ?? '';
  const [esquema, token] = cabecalho.split(' ');
  if (esquema?.toLowerCase() !== 'bearer' || !token) return next(naoAutorizado());

  const sessao = await verificarToken(token);
  if (!sessao) return next(naoAutorizado());

  const usuario = await repo.buscarUsuarioPorId(pool, sessao.id);
  if (!usuario) return next(naoAutorizado()); // usuário apagado: sessão encerrada
  // Senha trocada/redefinida depois da emissão do token: sessão antiga encerrada.
  if (sessao.emitidoEm < Math.floor(new Date(usuario.senha_alterada_em).getTime() / 1000)) return next(naoAutorizado());

  req.admin = usuario;
  const rota = req.originalUrl.split('?')[0];
  res.on('finish', () => {
    repo
      .registrarAcesso(pool, { usuarioId: usuario.id, email: usuario.email, evento: 'acesso', metodo: req.method, rota, status: res.statusCode, ip: req.ip })
      .catch((err) => logger.error('Falha ao registrar acesso ao painel', { request_id: req.id, erro: serializarErro(err) }));
  });
  next();
}
