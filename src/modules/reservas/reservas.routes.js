import { Router } from 'express';
import { validar } from '../../middlewares/validar.js';
import { limiteCancelamento, limiteCriacaoReserva } from '../../middlewares/rate-limit.js';
import { cancelarReservaBody, cancelarReservaParams, consultarHorariosQuery, criarReservaBody } from './reservas.schemas.js';
import * as controller from './reservas.controller.js';

export const rotasDeReservas = Router();

// Middleware chain: [rate limit] -> [validação/sanitização] -> controller -> (erro) -> error handler
rotasDeReservas.get('/horarios', validar({ query: consultarHorariosQuery }), controller.listarHorarios);

rotasDeReservas.post('/reservas', limiteCriacaoReserva, validar({ body: criarReservaBody }), controller.criarReserva);

// Cancelamento pelo link do e-mail (o token vai no corpo, nunca na URL: não cai em log de acesso).
rotasDeReservas.delete(
  '/reservas/:codigo',
  limiteCancelamento,
  validar({ params: cancelarReservaParams, body: cancelarReservaBody }),
  controller.cancelarReserva,
);
