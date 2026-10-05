import { Router } from 'express';
import { validar } from '../../middlewares/validar.js';
import { limiteLogin } from '../../middlewares/rate-limit.js';
import { loginBody } from './auth.schemas.js';
import { entrar } from './auth.service.js';

export const rotasDeAuth = Router();

// POST /api/auth/login -> { token, expira_em, usuario }
rotasDeAuth.post('/auth/login', limiteLogin, validar({ body: loginBody }), async (req, res) => {
  const resultado = await entrar(req.validado.body, { ip: req.ip });
  res.json(resultado);
});
