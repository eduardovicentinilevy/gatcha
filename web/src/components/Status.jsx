import { useEffect, useState } from 'react';
import { cafeAberto } from '../util.js';

/** Selo "Aberto agora / Fechado agora", recalculado a cada minuto. */
export default function StatusFuncionamento() {
  const [aberto, setAberto] = useState(cafeAberto);
  useEffect(() => {
    const t = setInterval(() => setAberto(cafeAberto()), 60_000);
    return () => clearInterval(t);
  }, []);
  return (
    <span className={`status${aberto ? ' status--aberto' : ''}`}>
      <span className="status__ponto" aria-hidden="true" />
      {aberto ? 'Aberto agora' : 'Fechado agora'}
    </span>
  );
}
