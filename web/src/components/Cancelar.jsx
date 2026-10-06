import { useEffect, useRef, useState } from 'react';
import { CONFIG, linkInstagram } from '../config.js';
import { api, ErroApi } from '../api.js';
import { rotuloDia } from '../util.js';

/** O link do e-mail é /cancelar#GATCHA-XXXXXX.<token>. O "#" não vai ao servidor nem a logs de acesso. */
function lerLink() {
  const m = /^#(GATCHA-[0-9A-Z]{6})\.([\w-]{32})$/.exec(window.location.hash);
  return m ? { codigo: m[1], token: m[2] } : null;
}

export default function Cancelar({ className = '' }) {
  const [link] = useState(lerLink);
  const [estado, setEstado] = useState({ tipo: 'pronto' }); // pronto | enviando | ok | erro
  const titulo = useRef(null);

  // Tira o token da barra de endereço (e do histórico) assim que ele foi lido.
  useEffect(() => {
    if (window.location.hash) window.history.replaceState(null, '', window.location.pathname);
  }, []);

  useEffect(() => {
    if (estado.tipo === 'ok' || estado.tipo === 'erro') titulo.current?.focus();
  }, [estado.tipo]);

  async function cancelar() {
    setEstado({ tipo: 'enviando' });
    try {
      const { reserva } = await api.cancelarReserva(link.codigo, link.token);
      setEstado({ tipo: 'ok', reserva });
    } catch (erro) {
      const mensagem =
        erro instanceof ErroApi && erro.status === 404
          ? 'Não encontramos essa reserva. Confere se abriu o link completo do e-mail de confirmação.'
          : erro.message;
      setEstado({ tipo: 'erro', mensagem, codigo: erro.codigo });
    }
  }

  const contato = (
    <a href={linkInstagram()} target="_blank" rel="noopener noreferrer">@{CONFIG.contato.instagram}</a>
  );

  return (
    <main id="conteudo" className={`container texto cartao cancelar ${className}`}>
      <p className="sobretitulo">Reserva do gatil</p>

      {!link && (
        <>
          <h1>Link incompleto</h1>
          <p>Abra o link de cancelamento direto do e-mail de confirmação (ele é longo, então às vezes o leitor de e-mail corta). Se não der, fala com a gente no Instagram: {contato}.</p>
          <a className="botao" href="/">Voltar ao site</a>
        </>
      )}

      {link && (estado.tipo === 'pronto' || estado.tipo === 'enviando') && (
        <>
          <h1>Cancelar a reserva <span className="sem-quebra">{link.codigo}</span>?</h1>
          <p>A vaga volta pra agenda e outra pessoa vai poder reservar. Se quiser outro horário, é só fazer uma nova reserva depois.</p>
          <div className="cancelar__acoes">
            <button type="button" className="botao" onClick={cancelar} disabled={estado.tipo === 'enviando'}>
              {estado.tipo === 'enviando' ? 'Cancelando…' : 'Sim, cancelar minha reserva'}
            </button>
            <a className="botao botao--secundario" href="/">Não, manter a reserva</a>
          </div>
        </>
      )}

      {estado.tipo === 'ok' && (
        <>
          <h1 ref={titulo} tabIndex={-1}>Reserva cancelada</h1>
          <p className="alerta alerta--ok" role="status">
            A reserva {estado.reserva.codigo} de {rotuloDia(estado.reserva.data).longo}, às {estado.reserva.hora_inicio}, foi cancelada. Obrigado por avisar 🐾
          </p>
          <a className="botao" href="/#reserva">Fazer outra reserva</a>
        </>
      )}

      {estado.tipo === 'erro' && (
        <>
          <h1 ref={titulo} tabIndex={-1}>Não deu pra cancelar</h1>
          <p className="alerta" role="alert">{estado.mensagem}</p>
          {estado.codigo !== 'RESERVA_NAO_ATIVA' && <p>Precisa de ajuda? Fala com a gente no Instagram: {contato}.</p>}
          <a className="botao botao--secundario" href="/">Voltar ao site</a>
        </>
      )}
    </main>
  );
}
