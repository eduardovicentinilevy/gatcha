/** Traço do gato-tigela de matchá (o avatar do Gatchá), em SVG. */
const TRACOS = [
  'M64.6 72.4 72.7 55.8 82.3 71M116 72.6 124.9 58.2 132 77.4',
  'M48.6 71.9C80 64 128 70 154.6 82.3 148 92 100 90 48.6 71.9Z',
  'M48.6 71.9C49 98 52 120 58.2 130.5 72 143 112 146 138.6 126.5 149 112 153 96 154.6 82.3',
  'M89.8 101.6v1.6M106.4 101.6v1.6',
  'M91.5 111c2 4 5 4 6.9 0 1.9 4 4.9 4 6.9 0',
  'M42.1 104.8 72.7 108.8M43.8 118.5 72.7 114.5M48.6 127.3 72.7 120.9M134.6 108.8 161 106.4M134.6 116 162.7 120M132 122.5 158.6 130.5',
];

/** Só o desenho (sem o círculo verde), para avatares coloridos. */
export function TracoGato() {
  return (
    <svg viewBox="36 50 132 98" aria-hidden="true">
      {TRACOS.map((d) => <path key={d} d={d} />)}
    </svg>
  );
}

/** Logo completo: círculo verde matchá + traço branco. */
export default function LogoGato({ tamanho = 40, className }) {
  return (
    <svg className={className} viewBox="0 0 200 200" width={tamanho} height={tamanho} aria-hidden="true">
      <circle cx="100" cy="100" r="98" fill="#6BA305" />
      <g fill="none" stroke="#fff" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round">
        {TRACOS.map((d) => <path key={d} d={d} />)}
      </g>
    </svg>
  );
}
