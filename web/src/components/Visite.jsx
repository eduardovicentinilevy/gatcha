import { useState } from 'react';
import { CONFIG, linkInstagram, linkWhatsapp } from '../config.js';
import { IconeInstagram, IconeMapa, IconeMetro, IconeRelogio, IconeWhatsapp } from './Icones.jsx';

const consulta = encodeURIComponent(CONFIG.endereco.consultaMapa);
const MAPA_EMBED = `https://www.google.com/maps?q=${consulta}&output=embed`;
const MAPA_LINK = `https://www.google.com/maps/search/?api=1&query=${consulta}`;

export default function Visite() {
  // O mapa do Google só carrega quando a pessoa pede: mais rápido em 4G e sem
  // cookies de terceiros antes do consentimento (LGPD).
  const [mapa, setMapa] = useState(false);
  const whatsapp = linkWhatsapp();
  const { endereco, funcionamento, contato } = CONFIG;

  return (
    <section id="visite" className="secao secao--escura" aria-labelledby="titulo-visite">
      <div className="container visite">
        <div className="visite__info" data-revelar>
          <p className="sobretitulo">Visite</p>
          <h2 id="titulo-visite">{CONFIG.textos.visite.titulo}</h2>
          <address className="visite__endereco">
            <IconeMapa /> <span>{endereco.linha1}<br />{endereco.linha2}</span>
          </address>

          <h3><IconeMetro /> Como chegar</h3>
          <ul className="lista">{endereco.comoChegar.map((t) => <li key={t}>{t}</li>)}</ul>

          <h3><IconeRelogio /> Horários</h3>
          <dl className="horarios-funcionamento">
            {funcionamento.map((f) => (
              <div key={f.dias}>
                <dt>{f.dias}</dt>
                <dd>{f.horarios.map((h) => <span key={h}>{h}</span>)}</dd>
              </div>
            ))}
          </dl>

          <h3>Fala com a gente</h3>
          <div className="contatos">
            <a className="botao botao--claro" href={linkInstagram()} target="_blank" rel="noopener noreferrer"><IconeInstagram /> @{contato.instagram}</a>
            {whatsapp ? (
              <a className="botao botao--claro" href={whatsapp} target="_blank" rel="noopener noreferrer"><IconeWhatsapp /> WhatsApp</a>
            ) : (
              <span className="botao botao--claro botao--inativo" aria-disabled="true"><IconeWhatsapp /> WhatsApp em breve</span>
            )}
            {contato.email && <a className="botao botao--claro" href={`mailto:${contato.email}`}>{contato.email}</a>}
          </div>
        </div>

        <div className="mapa cartao" data-revelar>
          {mapa ? (
            <iframe
              title="Mapa: Gatchá na Galeria Metrópole"
              src={MAPA_EMBED}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              allowFullScreen
            />
          ) : (
            <div className="mapa__capa">
              <IconeMapa />
              <p>Av. São Luís, 187 · República</p>
              <button type="button" className="botao" onClick={() => setMapa(true)}>Mostrar mapa</button>
              <a className="link" href={MAPA_LINK} target="_blank" rel="noopener noreferrer">Abrir no Google Maps</a>
              <p className="nota">O mapa é carregado do Google só quando você clicar.</p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
