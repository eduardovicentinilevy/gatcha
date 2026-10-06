/**
 * Texto do e-mail de confirmação (texto puro + HTML simples). Tudo que vem de
 * pessoas (nome) é escapado no HTML, por segurança, mesmo já validado na entrada.
 */
import { config } from '../../config/env.js';

const escapar = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const fmtData = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });
const dataPorExtenso = (iso) => fmtData.format(new Date(`${iso}T12:00:00Z`));

export const linkDeCancelamento = (codigo, token) => `${config.siteUrl}/cancelar#${codigo}.${token}`;

export function montarEmailConfirmacao({ reserva, token }) {
  const horas = config.gatil.cancelamentoAteHorasAntes;
  const prazo = horas === 0 ? 'até o horário da reserva' : `até ${horas} ${horas === 1 ? 'hora' : 'horas'} antes`;
  const quando = `${dataPorExtenso(reserva.data)}, às ${reserva.hora_inicio}`;
  const detalhes = `${reserva.duracao_min} minutos · ${reserva.pessoas} ${reserva.pessoas === 1 ? 'pessoa' : 'pessoas'}`;
  const link = linkDeCancelamento(reserva.codigo, token);
  const primeiroNome = reserva.nome.split(' ')[0];

  const texto = [
    `Oi, ${primeiroNome}! Sua reserva no gatil do Gatchá está confirmada 🐾`,
    '',
    `Código: ${reserva.codigo}`,
    `Quando: ${quando}`,
    `Duração: ${detalhes}`,
    'Onde: Av. São Luís, 187 · Piso 02, Loja 02, Galeria Metrópole, República, São Paulo',
    'Pagamento: no local.',
    '',
    `Mudou de planos? Dá pra cancelar ${prazo} do horário, por este link (é só seu, não compartilhe):`,
    link,
    '',
    'Até já! 🍵',
  ].join('\n');

  const html = `<div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:auto;color:#14180F">
<p style="font-size:18px"><strong>Oi, ${escapar(primeiroNome)}!</strong> Sua reserva no gatil do Gatchá está confirmada 🐾</p>
<table style="border-collapse:collapse;width:100%;background:#F4EBD9;border-radius:8px"><tr><td style="padding:14px">
<div><strong>Código:</strong> ${escapar(reserva.codigo)}</div>
<div><strong>Quando:</strong> ${escapar(quando)}</div>
<div><strong>Duração:</strong> ${escapar(detalhes)}</div>
<div><strong>Onde:</strong> Av. São Luís, 187 · Piso 02, Loja 02, Galeria Metrópole, República, São Paulo</div>
<div><strong>Pagamento:</strong> no local</div></td></tr></table>
<p>Mudou de planos? Dá pra cancelar ${escapar(prazo)} do horário:</p>
<p><a href="${escapar(link)}" style="display:inline-block;background:#6BA305;color:#14180F;font-weight:bold;text-decoration:none;padding:12px 22px;border-radius:999px;border:2px solid #14180F">Cancelar minha reserva</a></p>
<p style="color:#4A5243;font-size:13px">Este link é só seu, não compartilhe. Até já! 🍵</p></div>`;

  return { assunto: `Reserva confirmada ${reserva.codigo} · Gatchá`, texto, html };
}
