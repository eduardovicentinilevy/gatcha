import { CONFIG, linkInstagram } from '../config.js';
import Foto from './Foto.jsx';
import { IconeInstagram } from './Icones.jsx';

const ICONES = ['xicara', 'gato', 'patinha', 'gato', 'xicara', 'gato'];
const TONS = ['matcha', 'creme', 'rosa', 'creme', 'matcha', 'rosa'];

export default function SigaAGente() {
  const { instagram } = CONFIG.textos;
  return (
    <section className="secao" aria-labelledby="titulo-instagram">
      <div className="container siga">
        <header className="secao__topo" data-revelar>
          <p className="sobretitulo">@{CONFIG.contato.instagram}</p>
          <h2 id="titulo-instagram">{instagram.titulo}</h2>
          <p>{instagram.subtitulo}</p>
          <a className="botao" href={linkInstagram()} target="_blank" rel="noopener noreferrer">
            <IconeInstagram /> Seguir no Instagram
          </a>
        </header>
        <ul className="feed" data-revelar>
          {CONFIG.feedInstagram.map((alt, i) => (
            <li key={alt}>
              <Foto alt={alt} proporcao="1/1" icone={ICONES[i % ICONES.length]} tom={TONS[i % TONS.length]} />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
