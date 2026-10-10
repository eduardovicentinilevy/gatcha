import { Router } from 'express';
import { limiteLogin } from '../../middlewares/rate-limit.js';
import { validar } from '../../middlewares/validar.js';
import { exigirAdmin } from './auth.middleware.js';
import { confirmar2faBody } from './auth.schemas.js';
import { confirmarAtivacao, desativar, iniciarAtivacao } from './dois-fatores.js';
import { rotasDoPainelDados } from '../painel/painel.routes.js';

/**
 * Tudo em /api/admin/* exige login. As telas do painel (gatos, cardápio,
 * fotos, interessados, segurança da conta) entram aqui, já protegidas e com log de acesso.
 */
export const rotasDoPainel = Router();
rotasDoPainel.use('/admin', exigirAdmin);

// Quem sou eu: usado pelo painel para saber se a sessão ainda vale e se o 2FA está ativo.
rotasDoPainel.get('/admin/eu', (req, res) => {
  res.json({ usuario: { email: req.admin.email, dois_fatores: req.admin.dois_fatores } });
});

// 2FA da própria conta. Ativar/desativar conferem a senha: mesmo limite por IP do login.
rotasDoPainel.post('/admin/2fa/iniciar', async (req, res) => {
  res.json(await iniciarAtivacao(req.admin));
});
rotasDoPainel.post('/admin/2fa/ativar', limiteLogin, validar({ body: confirmar2faBody }), async (req, res) => {
  res.json(await confirmarAtivacao(req.admin, req.validado.body, { ip: req.ip }));
});
rotasDoPainel.post('/admin/2fa/desativar', limiteLogin, validar({ body: confirmar2faBody }), async (req, res) => {
  res.json(await desativar(req.admin, req.validado.body, { ip: req.ip }));
});

rotasDoPainel.use('/admin', rotasDoPainelDados);
