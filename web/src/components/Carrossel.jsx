import { useCallback, useEffect, useRef, useState } from 'react';
import { reduzirMovimento } from '../util.js';
import { IconeSetaDir, IconeSetaEsq } from './Icones.jsx';

/**
 * Carrossel leve: rolagem nativa com scroll-snap (deslizar com o dedo no
 * celular), setas para clicar e indicador de posição. Sem biblioteca.
 * `loop`: no último card, "próximo" volta ao primeiro (e vice-versa).
 */
export default function Carrossel({ rotulo, itens, chave, renderItem, classe = '', loop = false }) {
  const trilho = useRef(null);
  const [estado, setEstado] = useState({ inicio: true, fim: false, atual: 0, porTela: 1 });

  const medir = useCallback(() => {
    const el = trilho.current;
    if (!el || !el.firstElementChild) return;
    const passo = el.firstElementChild.getBoundingClientRect().width;
    setEstado({
      inicio: el.scrollLeft <= 4,
      fim: el.scrollLeft + el.clientWidth >= el.scrollWidth - 4,
      atual: Math.min(itens.length - 1, Math.round(el.scrollLeft / Math.max(1, passo))),
      porTela: Math.max(1, Math.round(el.clientWidth / Math.max(1, passo))),
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
    const behavior = reduzirMovimento() ? 'auto' : 'smooth';
    if (loop && direcao > 0 && estado.fim) return el.scrollTo({ left: 0, behavior });
    if (loop && direcao < 0 && estado.inicio) return el.scrollTo({ left: el.scrollWidth, behavior });
    const largura = el.firstElementChild?.getBoundingClientRect().width ?? el.clientWidth;
    el.scrollBy({ left: direcao * (largura + 16), behavior });
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
          <button type="button" className="botao-icone" onClick={() => mover(-1)} disabled={!loop && estado.inicio} aria-label="Anterior">
            <IconeSetaEsq />
          </button>
          {itens.length > 7 ? (
            <p className="carrossel__contador">
              {estado.porTela > 1
                ? `${estado.atual + 1}–${Math.min(itens.length, estado.atual + estado.porTela)} de ${itens.length}`
                : `${estado.atual + 1} de ${itens.length}`}
            </p>
          ) : (
            <div className="carrossel__pontos" aria-hidden="true">
              {itens.map((item, i) => <span key={chave(item)} className={i === estado.atual ? 'ativo' : ''} />)}
            </div>
          )}
          <button type="button" className="botao-icone" onClick={() => mover(1)} disabled={!loop && estado.fim} aria-label="Próximo">
            <IconeSetaDir />
          </button>
        </div>
      )}
    </div>
  );
}
