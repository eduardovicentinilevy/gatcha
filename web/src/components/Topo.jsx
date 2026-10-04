import { useEffect, useRef, useState } from 'react';
import LogoGato from './LogoGato.jsx';

const LINKS = [
  ['#cardapio', 'Cardápio'],
  ['#gatil', 'Gatil'],
  ['#adocao', 'Adoção'],
  ['#visite', 'Visite'],
];

export default function Topo({ comMenu }) {
  const [aberto, setAberto] = useState(false);
  const botao = useRef(null);

  useEffect(() => {
    if (!aberto) return undefined;
    const aoTeclar = (e) => {
      if (e.key === 'Escape') {
        setAberto(false);
        botao.current?.focus();
      }
    };
    document.addEventListener('keydown', aoTeclar);
    return () => document.removeEventListener('keydown', aoTeclar);
  }, [aberto]);

  return (
    <header className="topo">
      <div className="topo__barra container">
        <a className="marca" href={comMenu ? '#inicio' : '/'} aria-label="Gatchá, início">
          <LogoGato tamanho={40} />
          <span>Gatchá</span>
        </a>
        {comMenu && (
          <>
            <button
              ref={botao}
              className="menu-botao"
              type="button"
              aria-expanded={aberto}
              aria-controls="menu-principal"
              onClick={() => setAberto((v) => !v)}
            >
              <span className="sr">{aberto ? 'Fechar menu' : 'Abrir menu'}</span>
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16" /></svg>
            </button>
            <nav id="menu-principal" className={`menu${aberto ? ' aberto' : ''}`} aria-label="Principal">
              {LINKS.map(([href, texto]) => (
                <a key={href} href={href} onClick={() => setAberto(false)}>{texto}</a>
              ))}
            </nav>
          </>
        )}
        <a className="botao botao--pequeno topo__cta" href={comMenu ? '#reserva' : '/#reserva'}>Reservar</a>
      </div>
    </header>
  );
}
