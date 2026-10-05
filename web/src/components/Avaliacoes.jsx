import { CONFIG } from '../config.js';
import { IconeEstrela } from './Icones.jsx';

export default function Avaliacoes() {
  return (
    <section className="secao secao--creme" aria-labelledby="titulo-avaliacoes">
      <div className="container">
        <header className="secao__topo" data-revelar>
          <p className="sobretitulo">Avaliações</p>
          <h2 id="titulo-avaliacoes">{CONFIG.textos.avaliacoes.titulo}</h2>
        </header>
        <ul className="avaliacoes">
          {CONFIG.avaliacoes.map((a) => (
            <li key={a.nome} className="avaliacao cartao" data-revelar>
              <p className="estrelas" role="img" aria-label={`${a.nota} de 5 estrelas`}>
                {Array.from({ length: 5 }, (_, i) => <IconeEstrela key={i} className={i < a.nota ? 'cheia' : ''} />)}
              </p>
              <blockquote><p>“{a.texto}”</p></blockquote>
              <p className="avaliacao__autor">{a.nome}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
