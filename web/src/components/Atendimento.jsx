import { useEffect, useId, useRef, useState } from 'react';
import { CONFIG, linkInstagram, linkWhatsapp } from '../config.js';
import { IconeChat, IconeFechar, IconeInstagram, IconeWhatsapp } from './Icones.jsx';

/**
 * Botão flutuante de atendimento + painel com WhatsApp, perguntas frequentes e Instagram.
 * No celular fica acima da barra "Reservar gatil" (posição via CSS), sem cobri-la.
 */
export default function Atendimento() {
  const [aberto, setAberto] = useState(false);
  const painel = useRef(null);
  const botao = useRef(null);
  const idTitulo = useId();
  const whatsapp = linkWhatsapp();

  useEffect(() => {
    if (!aberto) return undefined;
    painel.current?.querySelector('h2')?.focus();
    const aoTeclar = (e) => {
      if (e.key === 'Escape') {
        setAberto(false);
        botao.current?.focus();
      }
    };
    const aoClicarFora = (e) => {
      if (!painel.current?.contains(e.target) && !botao.current?.contains(e.target)) setAberto(false);
    };
    document.addEventListener('keydown', aoTeclar);
    document.addEventListener('pointerdown', aoClicarFora);
    return () => {
      document.removeEventListener('keydown', aoTeclar);
      document.removeEventListener('pointerdown', aoClicarFora);
    };
  }, [aberto]);

  return (
    <div className="atendimento">
      {aberto && (
        <div ref={painel} className="atendimento__painel cartao" role="dialog" aria-modal="false" aria-labelledby={idTitulo}>
          <div className="atendimento__topo">
            <h2 id={idTitulo} tabIndex={-1}>Bora conversar? 🐾</h2>
            <button type="button" className="botao-icone" aria-label="Fechar atendimento" onClick={() => setAberto(false)}><IconeFechar /></button>
          </div>
          {whatsapp ? (
            <a className="botao botao--grande botao--largo" href={whatsapp} target="_blank" rel="noopener noreferrer"><IconeWhatsapp /> Chamar no WhatsApp</a>
          ) : (
            <p className="nota">WhatsApp em breve. Enquanto isso, chama a gente no Instagram!</p>
          )}
          <h3 className="atendimento__subtitulo">Perguntas frequentes</h3>
          <div className="faq">
            {CONFIG.faq.map((f) => (
              <details key={f.pergunta}>
                <summary>{f.pergunta}</summary>
                <p>{f.resposta}</p>
              </details>
            ))}
          </div>
          <a className="botao botao--secundario botao--largo" href={linkInstagram()} target="_blank" rel="noopener noreferrer">
            <IconeInstagram /> @{CONFIG.contato.instagram}
          </a>
        </div>
      )}
      <button
        ref={botao}
        type="button"
        className="atendimento__botao"
        aria-expanded={aberto}
        aria-label={aberto ? 'Fechar atendimento' : 'Atendimento: dúvidas e contato'}
        onClick={() => setAberto((v) => !v)}
      >
        {aberto ? <IconeFechar /> : <IconeChat />}
      </button>
    </div>
  );
}
