import { CONFIG } from '../config.js';
import { reais } from '../util.js';
import { IconeRelogio } from './Icones.jsx';

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
          <div className="gatil__lado">
            <div className="precos">
              {Object.entries(gatil.precosCentavos).map(([minutos, centavos]) => (
                <div key={minutos} className="preco cartao">
                  <p className="preco__tempo">{minutos} min</p>
                  <p className="preco__valor">{reais(centavos)}</p>
                  <p className="preco__por">por pessoa</p>
                </div>
              ))}
            </div>
            <div className="janelas cartao">
              <h3><IconeRelogio aria-hidden="true" /> Horários da área dos gatos</h3>
              <p className="janelas__dias">{gatil.diasTexto}</p>
              <ul className="janelas__lista">
                {gatil.janelas.map((j) => <li key={j.abre} className="janela">{j.texto}</li>)}
              </ul>
              <p className="nota">Fora desses horários a área dos gatos fica fechada: é a hora do descanso deles 😴</p>
            </div>
            <div id="reserva" className="balcao cartao">
              <span className="balcao__icone" aria-hidden="true">🐾</span>
              <div>
                <h3>{textos.gatil.reservaTitulo}</h3>
                <p>{textos.gatil.reservaTexto}</p>
              </div>
            </div>
          </div>
          <div className="regras cartao">
            <h3>Regras do Gatchá</h3>
            <ul>
              {gatil.regras.map(([emoji, texto]) => (
                <li key={texto}><span className="regras__emoji" aria-hidden="true">{emoji}</span><span>{texto}</span></li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
