import { Router } from 'express';
import { exigirAdmin } from './auth.middleware.js';
import { rotasDoPainelDados } from '../painel/painel.routes.js';

/**
 * Tudo em /api/admin/* exige login. As telas do painel (gatos, cardápio,
 * fotos, interessados) entram aqui, já protegidas e com log de acesso.
 */
export const rotasDoPainel = Router();
rotasDoPainel.use('/admin', exigirAdmin);

// Quem sou eu: usado pelo painel para saber se a sessão ainda vale.
rotasDoPainel.get('/admin/eu', (req, res) => {
  res.json({ usuario: { email: req.admin.email } });
});

rotasDoPainel.use('/admin', rotasDoPainelDados);
