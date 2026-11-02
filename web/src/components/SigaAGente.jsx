import { CONFIG, linkInstagram } from '../config.js';
import Foto from './Foto.jsx';
import { IconeInstagram } from './Icones.jsx';

const ICONES = ['tigela', 'gato', 'doce', 'gato', 'xicara', 'onigiri'];
const TONS = ['matcha', 'creme', 'rosa', 'creme', 'matcha', 'rosa'];

export default function SigaAGente() {
  const { instagram } = CONFIG.textos;
  const posts = CONFIG.feedInstagram;
  const instagramUrl = linkInstagram();
  // Mosaico (1ª foto em 2x2) só fecha a grade de 3 colunas sem buracos com 3, 6, 9... fotos.
  const mosaico = posts.length >= 6 && posts.length % 3 === 0;
  return (
    <section id="instagram" className="secao secao--creme" aria-labelledby="titulo-instagram">
      <div className="container siga">
        <header className="secao__topo" data-revelar>
          <p className="sobretitulo">@{CONFIG.contato.instagram}</p>
          <h2 id="titulo-instagram">{instagram.titulo}</h2>
          <p>{instagram.subtitulo}</p>
          <a className="botao" href={instagramUrl} target="_blank" rel="noopener noreferrer">
            <IconeInstagram /> Seguir no Instagram
          </a>
        </header>
        <ul className={`feed${mosaico ? ' feed--mosaico' : ''}`} data-revelar>
          {posts.map((post, i) => {
            // Cada item pode ser só o texto alternativo, ou { foto, alt }.
            const { foto, alt } = typeof post === 'string' ? { alt: post } : post;
            return (
              <li key={alt}>
                <Foto src={foto} alt={alt} proporcao="1/1" icone={ICONES[i % ICONES.length]} tom={TONS[i % TONS.length]} />
                {/* Clique na foto também abre o Instagram. Fica fora do Tab e dos leitores de tela:
                    o botão "Seguir no Instagram" já é o link, e a foto continua lida pelo texto alternativo. */}
                <a className="feed__link" href={instagramUrl} target="_blank" rel="noopener noreferrer" tabIndex={-1} aria-hidden="true" />
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
