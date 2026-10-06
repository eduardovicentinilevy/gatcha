/**
 * Controller: adaptador HTTP fino. Lê a entrada JÁ validada (req.validado),
 * chama o Service e formata a resposta. Erros sobem para o error handler
 * global (Express 5 encaminha rejeições de funções async automaticamente).
 */
import * as service from './reservas.service.js';

export async function listarHorarios(req, res) {
  const resultado = await service.consultarHorarios(req.validado.query.data);
  res.json(resultado);
}

export async function criarReserva(req, res) {
  const reserva = await service.criarReserva(req.validado.body);
  // Devolve só o necessário: e-mail e telefone não ecoam na resposta (minimização, LGPD).
  res.status(201).json({ reserva });
}

export async function cancelarReserva(req, res) {
  const reserva = await service.cancelarReserva({ codigo: req.validado.params.codigo, token: req.validado.body.token });
  res.json({ reserva });
}
