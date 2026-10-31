import { useCallback, useEffect, useState } from 'react';
import { useTema } from './tema.js';
import { reduzirMovimento } from './util.js';
import Topo from './components/Topo.jsx';
import Hero from './components/Hero.jsx';
import Faixa from './components/Faixa.jsx';
import Gatil from './components/Gatil.jsx';
import SigaAGente from './components/SigaAGente.jsx';
import Visite from './components/Visite.jsx';
import Rodape from './components/Rodape.jsx';
import Atendimento from './components/Atendimento.jsx';
import Gatinho from './components/Gatinho.jsx';

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
    // A página é estática: tudo o que revela já está no DOM na primeira vez.
    document.querySelectorAll('[data-revelar]').forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);
}

/** Uma página só: a vitrine do Gatchá (o Firebase reescreve qualquer caminho para o index.html). */
export default function App() {
  const [tema, alternarTema] = useTema();
  const [gatinho, setGatinho] = useState(false);
  const esconderGatinho = useCallback(() => setGatinho(false), []);
  useRevelarAoRolar();

  return (
    <>
      <a className="pular" href="#conteudo">Pular para o conteúdo</a>
      <Topo tema={tema} onAlternarTema={alternarTema} onEasterEgg={() => setGatinho(true)} />
      <main id="conteudo">
        <Hero />
        <Faixa />
        <Gatil />
        <SigaAGente />
        <Visite />
      </main>
      <Rodape />
      <Atendimento />
      <Gatinho visivel={gatinho} onSumir={esconderGatinho} />
    </>
  );
}
