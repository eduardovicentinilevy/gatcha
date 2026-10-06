/**
 * Envio de e-mail. Três transportes (config EMAIL_TRANSPORTE):
 *  - smtp: envia de verdade (EMAIL_SMTP_URL vem do Secret Manager, nunca do Git).
 *  - log: só desenvolvimento. Escreve o e-mail no terminal para você clicar no link
 *    de cancelamento sem precisar de um servidor de e-mail. Proibido em produção
 *    (o link é uma credencial e não pode parar em log).
 *  - desligado: não envia nada.
 *
 * LGPD: nada aqui vai para o logger estruturado (destinatário e texto são dados pessoais).
 */
import nodemailer from 'nodemailer';
import { config } from '../config/env.js';

/** Só testes: e-mails "enviados" ficam aqui para os testes lerem o link. */
export const caixaDeSaidaDeTeste = [];

let transporte;

/** @param {{ para: string, assunto: string, texto: string, html?: string }} email */
export async function enviarEmail({ para, assunto, texto, html }) {
  const { transporte: tipo, smtpUrl, remetente } = config.email;
  if (tipo === 'desligado') return;

  if (tipo === 'log') {
    if (config.env === 'test') {
      caixaDeSaidaDeTeste.push({ para, assunto, texto, html });
    } else {
      console.log(`\n--- E-mail simulado (EMAIL_TRANSPORTE=log) ---\nPara: ${para}\nAssunto: ${assunto}\n\n${texto}\n----------------------------------------------\n`);
    }
    return;
  }

  transporte ??= nodemailer.createTransport(smtpUrl);
  await transporte.sendMail({ from: remetente, to: para, subject: assunto, text: texto, html });
}
