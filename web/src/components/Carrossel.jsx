import { useCallback, useEffect, useRef, useState } from 'react';
import { reduzirMovimento } from '../util.js';
import { IconeSetaDir, IconeSetaEsq } from './Icones.jsx';

/**
 * Carrossel leve: rolagem nativa com scroll-snap (swipe no celular de graça),
 * setas no desktop e indicadores de posição. Sem biblioteca.
 */
export default function Carrossel({ rotulo, itens, chave, renderItem, classe = '' }) {
  const trilho = useRef(null);
  const [estado, setEstado] = useState({ inicio: true, fim: false, atual: 0 });

  const medir = useCallback(() => {
    const el = trilho.current;
    if (!el || !el.firstElementChild) return;
    const passo = el.firstElementChild.getBoundingClientRect().width;
    setEstado({
      inicio: el.scrollLeft <= 4,
      fim: el.scrollLeft + el.clientWidth >= el.scrollWidth - 4,
      atual: Math.min(itens.length - 1, Math.round(el.scrollLeft / Math.max(1, passo))),
    });
  }, [itens.length]);

  useEffect(() => {
    const el = trilho.current;
    if (!el) return undefined;
    let quadro = 0;
    const aoRolar = () => {
      cancelAnimationFrame(quadro);
      quadro = requestAnimationFrame(medir);
    };
    medir();
    el.addEventListener('scroll', aoRolar, { passive: true });
    window.addEventListener('resize', aoRolar);
    return () => {
      el.removeEventListener('scroll', aoRolar);
      window.removeEventListener('resize', aoRolar);
      cancelAnimationFrame(quadro);
    };
  }, [medir]);

  const mover = (direcao) => {
    const el = trilho.current;
    const largura = el.firstElementChild?.getBoundingClientRect().width ?? el.clientWidth;
    el.scrollBy({ left: direcao * (largura + 16), behavior: reduzirMovimento() ? 'auto' : 'smooth' });
  };

  return (
    <div className={`carrossel ${classe}`} role="region" aria-roledescription="carrossel" aria-label={rotulo}>
      <ul ref={trilho} className="carrossel__trilho" tabIndex={0} aria-label={`${rotulo}: use as setas ou deslize para ver mais`}>
        {itens.map((item, i) => (
          <li key={chave(item)} className="carrossel__item" role="group" aria-roledescription="slide" aria-label={`${i + 1} de ${itens.length}`}>
            {renderItem(item, i)}
          </li>
        ))}
      </ul>
      {itens.length > 1 && (
        <div className="carrossel__controles">
          <button type="button" className="botao-icone" onClick={() => mover(-1)} disabled={estado.inicio} aria-label="Anterior">
            <IconeSetaEsq />
          </button>
          <div className="carrossel__pontos" aria-hidden="true">
            {itens.map((item, i) => <span key={chave(item)} className={i === estado.atual ? 'ativo' : ''} />)}
          </div>
          <button type="button" className="botao-icone" onClick={() => mover(1)} disabled={estado.fim} aria-label="Próximo">
            <IconeSetaDir />
          </button>
        </div>
      )}
    </div>
  );
}
