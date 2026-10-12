import { ICONES } from './Foto.jsx';

/**
 * Figurinhas que entram voando no início e flutuam em velocidades diferentes conforme a
 * página rola, atravessando a divisa com a seção seguinte (inspirado no modelo "Courante").
 * Puramente decorativas. Posições, velocidades e de onde cada uma vem ficam em estilo.css
 * (.figurinha--1 a --6). Com fotos recortadas dos produtos (PNG sem fundo), basta trocar o
 * ícone por <img> aqui.
 */
const FIGURINHAS = [
  { icone: 'tigela', tom: 'matcha' },
  { icone: 'doce', tom: 'rosa' },
  { icone: 'onigiri', tom: 'amarelo' },
  { icone: 'xicara', tom: 'claro' },
  { icone: 'gato', tom: 'claro' },
  { icone: 'copo', tom: 'rosa' },
];

export default function Flutuantes() {
  return (
    <div className="figurinhas" aria-hidden="true">
      {FIGURINHAS.map(({ icone, tom }, i) => {
        const Icone = ICONES[icone];
        return (
          <span key={icone} className={`figurinha figurinha--${i + 1}`}>
            <span className={`figurinha__corpo figurinha__corpo--${tom}`}><Icone /></span>
          </span>
        );
      })}
    </div>
  );
}
