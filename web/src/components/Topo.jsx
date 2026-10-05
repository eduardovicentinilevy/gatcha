import { useEffect, useRef, useState } from 'react';
import LogoGato from './LogoGato.jsx';
import { IconeFechar, IconeLua, IconeMenu, IconeSol } from './Icones.jsx';

const LINKS = [
  ['#cardapio', 'Cardápio'],
  ['#gatil', 'Gatil'],
  ['#adocao', 'Adoção'],
  ['#visite', 'Visite'],
];
const CLIQUES_PARA_O_GATINHO = 5;

export default function Topo({ comMenu, tema, onAlternarTema, onEasterEgg }) {
  const [aberto, setAberto] = useState(false);
  const botao = useRef(null);
  const cliques = useRef({ n: 0, ultimo: 0 });

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

  // Easter egg: 5 cliques rápidos no logo chamam um gatinho.
  function cliqueNoLogo() {
    const agora = Date.now();
    const c = cliques.current;
    c.n = agora - c.ultimo < 600 ? c.n + 1 : 1;
    c.ultimo = agora;
    if (c.n >= CLIQUES_PARA_O_GATINHO) {
      c.n = 0;
      onEasterEgg();
    }
  }

  const escuro = tema === 'escuro';
  return (
    <header className="topo">
      <div className="topo__barra container">
        <a className="marca" href={comMenu ? '#inicio' : '/'} aria-label="Gatchá, início" onClick={cliqueNoLogo}>
          <LogoGato tamanho={40} />
          <span>Gatchá</span>
        </a>

        {comMenu && (
          <nav id="menu-principal" className={`menu${aberto ? ' aberto' : ''}`} aria-label="Principal">
            {LINKS.map(([href, texto]) => (
              <a key={href} href={href} onClick={() => setAberto(false)}>{texto}</a>
            ))}
          </nav>
        )}

        <div className="topo__acoes">
          <button
            type="button"
            className="botao-icone"
            onClick={onAlternarTema}
            aria-label={escuro ? 'Usar tema claro' : 'Usar tema escuro'}
            title={escuro ? 'Tema claro' : 'Tema escuro'}
          >
            {escuro ? <IconeSol /> : <IconeLua />}
          </button>
          <a className="botao botao--pequeno topo__cta" href={comMenu ? '#reserva' : '/#reserva'}>Reservar gatil</a>
          {comMenu && (
            <button
              ref={botao}
              className="botao-icone menu-botao"
              type="button"
              aria-expanded={aberto}
              aria-controls="menu-principal"
              aria-label={aberto ? 'Fechar menu' : 'Abrir menu'}
              onClick={() => setAberto((v) => !v)}
            >
              {aberto ? <IconeFechar /> : <IconeMenu />}
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
