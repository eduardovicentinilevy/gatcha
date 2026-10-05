import { IconePatinha, IconeXicara } from './Icones.jsx';
import { TracoGato } from './LogoGato.jsx';

const ICONES = { gato: TracoGato, xicara: IconeXicara, patinha: IconePatinha };

/**
 * Foto com proporção fixa (sem "pulo" de layout) e lazy loading.
 * Sem URL (ou URL não-HTTPS), mostra um placeholder ilustrado com o texto
 * alternativo como rótulo acessível. [SUBSTITUIR por fotos reais]
 */
export default function Foto({ src, alt, proporcao = '4/3', icone = 'patinha', tom = 'matcha', className = '' }) {
  const classe = `foto foto--${proporcao.replace('/', 'x')} ${className}`;
  if (typeof src === 'string' && src.startsWith('https://')) {
    return <img className={classe} src={src} alt={alt} loading="lazy" decoding="async" referrerPolicy="no-referrer" />;
  }
  const Icone = ICONES[icone] ?? IconePatinha;
  return (
    <div className={`${classe} foto--placeholder foto--${tom}`} role="img" aria-label={alt}>
      <Icone />
    </div>
  );
}
