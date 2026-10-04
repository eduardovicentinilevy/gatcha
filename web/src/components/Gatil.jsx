import { CONFIG } from '../config.js';
import { reais } from '../util.js';
import Reserva from './Reserva.jsx';

const REGRAS = [
  'Higienize as mãos antes de entrar.',
  'Gato dormindo não se acorda; colo só se ele quiser.',
  'Não ofereça comida nem bebida aos gatos.',
  'Crianças sempre acompanhadas de um adulto.',
  'Fotos sem flash.',
];

export default function Gatil() {
  return (
    <section id="gatil" className="secao secao--verde" aria-labelledby="titulo-gatil">
      <div className="container">
        <header className="secao__topo">
          <p className="sobretitulo">Gatil</p>
          <h2 id="titulo-gatil">Um tempo com os gatos</h2>
          <p>O espaço é dos gatos: as vagas por horário são limitadas para que eles fiquem tranquilos. Pagamento no local.</p>
        </header>

        <div className="gatil__grade">
          <div className="precos">
            {Object.entries(CONFIG.precosGatilCentavos).map(([minutos, centavos]) => (
              <div key={minutos} className="preco">
                <p className="preco__tempo">{minutos} minutos</p>
                <p className="preco__valor">{reais(centavos)}</p>
                <p className="preco__por">por pessoa, pago no local</p>
              </div>
            ))}
          </div>
          <div className="regras">
            <h3>Regras do espaço</h3>
            <ul>{REGRAS.map((r) => <li key={r}>{r}</li>)}</ul>
          </div>
        </div>

        <Reserva />
      </div>
    </section>
  );
}
