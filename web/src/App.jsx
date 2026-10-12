import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import { useTema } from './tema.js';
import { usePagina } from './navegacao.js';
import { reduzirMovimento } from './util.js';
import Topo from './components/Topo.jsx';
import Hero from './components/Hero.jsx';
import Faixa from './components/Faixa.jsx';
import Cardapio from './components/Cardapio.jsx';
import Gatil from './components/Gatil.jsx';
import Adocao from './components/Adocao.jsx';
import SigaAGente from './components/SigaAGente.jsx';
import Visite from './components/Visite.jsx';
import Rodape from './components/Rodape.jsx';
import Atendimento from './components/Atendimento.jsx';
import Gatinho from './components/Gatinho.jsx';

// O painel só é baixado por quem abre /admin: o site público não carrega esse código.
const Admin = lazy(() => import('./admin/Admin.jsx'));

/**
 * Microanimações ao rolar: elementos com [data-revelar] surgem suavemente ao
 * entrar na tela. Desligado com prefers-reduced-motion (o conteúdo aparece direto).
 */
function useRevelarAoRolar() {
  useEffect(() => {
    if (reduzirMovimento() || !('IntersectionObserver' in window)) return undefined;
    document.documentElement.classList.add('com-animacao');
    const io = new IntersectionObserver(
      (entradas) => {
        for (const e of entradas) {
          if (e.isIntersecting) {
            e.target.classList.add('visivel');
            io.unobserve(e.target);
          }
        }
      },
      { rootMargin: '0px 0px -8% 0px' },
    );
    const observar = () => document.querySelectorAll('[data-revelar]:not(.visivel)').forEach((el) => io.observe(el));
    observar();
    const mo = new MutationObserver(observar); // cards que chegam depois (dados assíncronos)
    mo.observe(document.body, { childList: true, subtree: true });
    return () => {
      io.disconnect();
      mo.disconnect();
    };
  }, []);
}

/** Poucas páginas: não justifica um roteador. O Firebase reescreve tudo para o index.html
 *  e a troca entre elas é animada (src/navegacao.js). O painel (/admin) tem layout próprio. */
export default function App() {
  const [tema, alternarTema] = useTema();
  const [gatinho, setGatinho] = useState(false);
  const esconderGatinho = useCallback(() => setGatinho(false), []);
  const { pagina, animarSemApi } = usePagina();
  useRevelarAoRolar();
  const classePagina = animarSemApi ? 'pagina pagina--entrando' : 'pagina';

  if (pagina === 'admin') {
    return (
      <Suspense fallback={<p className="vazio">Carregando o painel…</p>}>
        <Admin tema={tema} onAlternarTema={alternarTema} />
      </Suspense>
    );
  }

  return (
    <>
      <a className="pular" href="#conteudo">Pular para o conteúdo</a>
      <Topo comMenu={pagina === 'inicio'} tema={tema} onAlternarTema={alternarTema} onEasterEgg={() => setGatinho(true)} />
      <main id="conteudo" key="inicio" className={classePagina}>
        <Hero />
        <Faixa />
        <Cardapio />
        <Gatil />
        <Adocao />
        <SigaAGente />
        <Visite />
      </main>
      <Rodape />
      <Atendimento />
      <Gatinho visivel={gatinho} onSumir={esconderGatinho} />
    </>
  );
}
