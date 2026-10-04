import { Router } from 'express';
import { validar } from '../../middlewares/validar.js';
import { limiteCriacaoReserva } from '../../middlewares/rate-limit.js';
import { consultarHorariosQuery, criarReservaBody } from './reservas.schemas.js';
import * as controller from './reservas.controller.js';

export const rotasDeReservas = Router();

// Middleware chain: [rate limit] -> [validação/sanitização] -> controller -> (erro) -> error handler
rotasDeReservas.get('/horarios', validar({ query: consultarHorariosQuery }), controller.listarHorarios);

rotasDeReservas.post('/reservas', limiteCriacaoReserva, validar({ body: criarReservaBody }), controller.criarReserva);
