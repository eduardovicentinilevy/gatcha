import { CONFIG } from '../config.js';
import { IconePatinha } from './Icones.jsx';

/**
 * Faixa inclinada entre o topo e o cardápio. Decorativa (aria-hidden): as mesmas
 * informações aparecem nas seções. Fica parada de propósito: letreiro rolando
 * distrai e, pela WCAG 2.2.2, precisaria de um botão de pausa.
 */
export default function Faixa() {
  // Repetida para cobrir telas largas; o excesso é cortado pelo CSS.
  const frases = [...CONFIG.textos.faixa, ...CONFIG.textos.faixa, ...CONFIG.textos.faixa];
  return (
    <div className="faixa" aria-hidden="true">
      <p className="faixa__trilho">
        {frases.map((f, i) => <span key={i}>{f}<IconePatinha /></span>)}
      </p>
    </div>
  );
}
