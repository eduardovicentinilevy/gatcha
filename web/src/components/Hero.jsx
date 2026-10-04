import LogoGato from './LogoGato.jsx';

const DESTAQUES = [
  ['Matchá de verdade', 'Bebidas quentes e geladas preparadas na hora.'],
  ['Gatil com vagas limitadas', 'Sessões de 15 ou 30 minutos, sem aperto.'],
  ['Adoção responsável', 'Em parceria com a ONG Abrigo São Gabriel.'],
];

export default function Hero() {
  return (
    <section id="inicio" className="hero">
      <div className="container hero__grade">
        <div className="hero__texto">
          <p className="selo">Galeria Metrópole · República · SP</p>
          <h1>Matchá, café e gatos esperando um lar.</h1>
          <p className="hero__sub">
            Reserve seu horário no gatil pelo celular em menos de um minuto e conheça antes quem vai te receber.
          </p>
          <div className="hero__acoes">
            <a className="botao" href="#reserva">Reservar o gatil</a>
            <a className="botao botao--contorno-claro" href="#adocao">Ver os gatos</a>
          </div>
        </div>
        <div className="hero__arte" aria-hidden="true">
          <div className="hero__anel"><LogoGato tamanho={280} /></div>
        </div>
      </div>
      <ul className="destaques container" aria-label="Destaques">
        {DESTAQUES.map(([titulo, texto]) => (
          <li key={titulo}><strong>{titulo}</strong><span>{texto}</span></li>
        ))}
      </ul>
    </section>
  );
}
