import { CONFIG } from '../config.js';
import { reais } from '../util.js';
import Reserva from './Reserva.jsx';

export default function Gatil() {
  const { gatil, textos } = CONFIG;
  return (
    <section id="gatil" className="secao secao--verde" aria-labelledby="titulo-gatil">
      <div className="container">
        <header className="secao__topo" data-revelar>
          <p className="sobretitulo">Gatil</p>
          <h2 id="titulo-gatil">{textos.gatil.titulo}</h2>
          <p>{textos.gatil.subtitulo}</p>
        </header>

        <div className="gatil__grade" data-revelar>
          <div className="precos">
            {Object.entries(gatil.precosCentavos).map(([minutos, centavos]) => (
              <div key={minutos} className="preco cartao">
                <p className="preco__tempo">{minutos} min</p>
                <p className="preco__valor">{reais(centavos)}</p>
                <p className="preco__por">por pessoa</p>
              </div>
            ))}
          </div>
          <div className="regras cartao">
            <h3>Combinados do gatil</h3>
            <ul>
              {gatil.regras.map(([emoji, texto]) => (
                <li key={texto}><span aria-hidden="true">{emoji}</span> {texto}</li>
              ))}
            </ul>
          </div>
        </div>

        <Reserva />
      </div>
    </section>
  );
}
