import { useEffect, useRef, useState } from 'react';

/**
 * Traço do gato-tigela de matchá (o avatar do Gatchá), em SVG, separado por partes
 * para o logo poder piscar, mexer as orelhas e os bigodes (estilos em estilo.css).
 */
const PARTES = {
  orelhaEsq: 'M64.6 72.4 72.7 55.8 82.3 71',
  orelhaDir: 'M116 72.6 124.9 58.2 132 77.4',
  borda: 'M48.6 71.9C80 64 128 70 154.6 82.3 148 92 100 90 48.6 71.9Z',
  tigela: 'M48.6 71.9C49 98 52 120 58.2 130.5 72 143 112 146 138.6 126.5 149 112 153 96 154.6 82.3',
  olhos: 'M89.8 101.6v1.6M106.4 101.6v1.6',
  boca: 'M91.5 111c2 4 5 4 6.9 0 1.9 4 4.9 4 6.9 0',
  bigodeEsq: 'M42.1 104.8 72.7 108.8M43.8 118.5 72.7 114.5M48.6 127.3 72.7 120.9',
  bigodeDir: 'M134.6 108.8 161 106.4M134.6 116 162.7 120M132 122.5 158.6 130.5',
};

/** Só o desenho (sem o círculo verde), para avatares coloridos. */
export function TracoGato() {
  return (
    <svg viewBox="36 50 132 98" aria-hidden="true">
      {Object.values(PARTES).map((d) => <path key={d} d={d} />)}
    </svg>
  );
}

/** true enquanto o elemento aparece na tela (sem IntersectionObserver: sempre true). */
function useNaTela(ref, ativo) {
  const [naTela, setNaTela] = useState(true);
  useEffect(() => {
    const el = ref.current;
    if (!ativo || !el || !('IntersectionObserver' in window)) return undefined;
    const io = new IntersectionObserver(([entrada]) => setNaTela(entrada.isIntersecting));
    io.observe(el);
    return () => io.disconnect();
  }, [ref, ativo]);
  return naTela;
}

/**
 * Logo completo: círculo verde matchá + traço branco.
 * `vivo`: o gato respira, pisca e mexe orelhas e bigodes sozinho (pausa fora da tela).
 * Sem `vivo`, ele só reage quando o cursor passa no link do logo.
 */
export default function LogoGato({ tamanho = 40, className, vivo = false }) {
  const ref = useRef(null);
  const naTela = useNaTela(ref, vivo);
  const classes = ['logo-gato', vivo && 'logo-gato--vivo', vivo && !naTela && 'logo-gato--pausado', className].filter(Boolean).join(' ');
  return (
    <svg ref={ref} className={classes} viewBox="0 0 200 200" width={tamanho} height={tamanho} aria-hidden="true">
      <circle cx="100" cy="100" r="98" fill="#6BA305" />
      <g className="logo-gato__gato" fill="none" stroke="#fff" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round">
        <path className="logo-gato__orelha logo-gato__orelha--esq" d={PARTES.orelhaEsq} />
        <path className="logo-gato__orelha logo-gato__orelha--dir" d={PARTES.orelhaDir} />
        <path d={PARTES.borda} />
        <path d={PARTES.tigela} />
        <path className="logo-gato__olhos" d={PARTES.olhos} />
        <path d={PARTES.boca} />
        <path className="logo-gato__bigode logo-gato__bigode--esq" d={PARTES.bigodeEsq} />
        <path className="logo-gato__bigode logo-gato__bigode--dir" d={PARTES.bigodeDir} />
      </g>
    </svg>
  );
}
