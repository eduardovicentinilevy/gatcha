import { CONFIG } from '../config.js';

const MAPA = 'https://www.google.com/maps/search/?api=1&query=' +
  encodeURIComponent('Gatchá Galeria Metrópole Av. São Luís 187');

export default function Visite() {
  return (
    <section id="visite" className="secao secao--escura" aria-labelledby="titulo-visite">
      <div className="container visite">
        <div>
          <p className="sobretitulo">Visite</p>
          <h2 id="titulo-visite">Estamos no 2º piso da Galeria Metrópole</h2>
          <address>
            Av. São Luís, 187 · Piso 02, Loja 02<br />
            República · São Paulo, SP
          </address>
          <a className="botao" href={MAPA} target="_blank" rel="noopener noreferrer">Abrir no mapa</a>
        </div>
        <dl className="info">
          <div><dt>Como chegar</dt><dd>Metrô República (linhas 3-Vermelha e 4-Amarela) ou Anhangabaú, a poucos minutos a pé.</dd></div>
          <div><dt>Horários</dt><dd>{CONFIG.horarioFuncionamento}</dd></div>
          <div><dt>Gatil</dt><dd>Sessões de 15 ou 30 minutos, com reserva pelo site.</dd></div>
        </dl>
      </div>
    </section>
  );
}
