import { useEffect, useRef, useState } from 'react';
import LogoGato from './LogoGato.jsx';
import { IconeFechar, IconeLua, IconeMenu, IconeSol } from './Icones.jsx';

const LINKS = [
  ['#gatil', 'Gatil'],
  ['#instagram', 'Instagram'],
  ['#visite', 'Visite'],
];
const CLIQUES_PARA_O_GATINHO = 5;

/** Cor de fundo efetiva de uma seção (sem cor própria: a da página). */
function corDeFundo(el) {
  const cor = getComputedStyle(el).backgroundColor;
  const transparente = cor === 'transparent' || /,\s*0\)$|\/\s*0\)$/.test(cor);
  return transparente ? getComputedStyle(document.body).backgroundColor : cor;
}

/** Luminância relativa (0 = preto, 1 = branco) de "rgb(r, g, b)". */
function luminancia(cor) {
  const [r, g, b] = (cor.match(/[\d.]+/g) ?? ['255', '255', '255']).slice(0, 3).map((v) => {
    const c = Number(v) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * Menu de vidro que se adapta a cada seção: transparente sobre o início e, ao rolar,
 * ganha a cor da seção que passa por baixo (texto claro em seção escura, escuro em clara).
 * Lê a cor de verdade da página, então acompanha o tema claro/escuro sem configurar nada.
 */
function useTopoAdaptavel(ref, tema) {
  useEffect(() => {
    const topo = ref.current;
    if (!topo) return undefined;
    let pedido = 0;
    const atualizar = () => {
      pedido = 0;
      const y = topo.getBoundingClientRect().bottom + 1;
      const alvo = document.elementsFromPoint(window.innerWidth / 2, y).find((el) => !topo.contains(el));
      const secao = alvo?.closest('section, footer') ?? document.body;
      const cor = corDeFundo(secao);
      topo.style.setProperty('--topo-tinta', cor);
      topo.dataset.fundo = luminancia(cor) < 0.35 ? 'escuro' : 'claro';
      topo.toggleAttribute('data-no-topo', window.scrollY < 8);
    };
    const pedir = () => {
      if (!pedido) pedido = requestAnimationFrame(atualizar);
    };
    pedir(); // no próximo quadro: o tema novo já foi aplicado na página
    window.addEventListener('scroll', pedir, { passive: true });
    window.addEventListener('resize', pedir);
    return () => {
      cancelAnimationFrame(pedido);
      window.removeEventListener('scroll', pedir);
      window.removeEventListener('resize', pedir);
    };
  }, [ref, tema]);
}

export default function Topo({ tema, onAlternarTema, onEasterEgg }) {
  const [aberto, setAberto] = useState(false);
  const botao = useRef(null);
  const cliques = useRef({ n: 0, ultimo: 0 });
  const topo = useRef(null);
  useTopoAdaptavel(topo, tema);

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
    <header ref={topo} className="topo" data-fundo="claro" data-no-topo="">
      <div className="topo__barra container">
        <a className="marca" href="#" aria-label="Gatchá, início" onClick={cliqueNoLogo}>
          <LogoGato tamanho={40} />
          <span>Gatchá</span>
        </a>

        <nav id="menu-principal" className={`menu${aberto ? ' aberto' : ''}`} aria-label="Principal">
          {LINKS.map(([href, texto]) => (
            <a key={href} href={href} onClick={() => setAberto(false)}>{texto}</a>
          ))}
        </nav>

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
          <a className="botao botao--pequeno topo__cta" href="#gatil">Conhecer o gatil</a>
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
        </div>
      </div>
    </header>
  );
}
