import { IconeCopo, IconeDoce, IconeOnigiri, IconePatinha, IconeTigela, IconeXicara } from './Icones.jsx';
import { TracoGato } from './LogoGato.jsx';

const ICONES = {
  gato: TracoGato, xicara: IconeXicara, patinha: IconePatinha, tigela: IconeTigela, doce: IconeDoce, onigiri: IconeOnigiri, copo: IconeCopo,
};

/**
 * Foto com proporção fixa (sem "pulo" de layout) e lazy loading.
 * Aceita URL HTTPS ou caminho do próprio site
 * (ex.: "/img/instagram/1.jpg", arquivo em web/public/img/instagram/).
 * Sem foto, mostra um placeholder ilustrado com o texto alternativo como rótulo acessível.
 */
export default function Foto({ src, alt, proporcao = '4/3', icone = 'patinha', tom = 'matcha', className = '' }) {
  const classe = `foto foto--${proporcao.replace('/', 'x')} ${className}`;
  const valida = typeof src === 'string' && (src.startsWith('https://') || /^\/(?!\/)/.test(src));
  if (valida) {
    return <img className={classe} src={src} alt={alt} loading="lazy" decoding="async" referrerPolicy="no-referrer" />;
  }
  const Icone = ICONES[icone] ?? IconePatinha;
  return (
    <div className={`${classe} foto--placeholder foto--${tom}`} role="img" aria-label={alt}>
      <Icone />
    </div>
  );
}
