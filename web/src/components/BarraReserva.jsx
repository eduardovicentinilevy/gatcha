import { useEffect, useState } from 'react';

/**
 * Botão "Reservar gatil" fixo no rodapé da tela (só no celular, via CSS).
 * Some enquanto a própria seção do gatil está visível, para não cobrir o formulário.
 */
export default function BarraReserva() {
  const [escondida, setEscondida] = useState(false);

  useEffect(() => {
    const gatil = document.getElementById('gatil');
    if (!gatil) return undefined;
    const observador = new IntersectionObserver(([e]) => setEscondida(e.isIntersecting), { threshold: 0.05 });
    observador.observe(gatil);
    return () => observador.disconnect();
  }, []);

  return (
    <div className={`barra-reserva${escondida ? ' barra-reserva--escondida' : ''}`} aria-hidden={escondida || undefined}>
      <a className="botao botao--grande" href="#reserva" tabIndex={escondida ? -1 : undefined}>
        Reservar gatil 🐾
      </a>
    </div>
  );
}
