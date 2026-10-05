import { useEffect } from 'react';
import { TracoGato } from './LogoGato.jsx';

/** Easter egg: um gatinho espia do canto da tela por alguns segundos. */
export default function Gatinho({ visivel, onSumir }) {
  useEffect(() => {
    if (!visivel) return undefined;
    const t = setTimeout(onSumir, 4000);
    return () => clearTimeout(t);
  }, [visivel, onSumir]);

  return (
    <div className={`gatinho${visivel ? ' gatinho--visivel' : ''}`} aria-hidden={!visivel}>
      <p className="gatinho__balao" role="status">{visivel ? 'Miau! Achou o segredo 🍵' : ''}</p>
      <div className="gatinho__corpo"><TracoGato /></div>
    </div>
  );
}
