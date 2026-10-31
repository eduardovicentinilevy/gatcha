import { CONFIG, linkInstagram, linkWhatsapp } from '../config.js';
import { IconeInstagram, IconeMapa, IconePatinha, IconeRelogio, IconeWhatsapp } from './Icones.jsx';
import StatusFuncionamento from './Status.jsx';

const LINKS = [
  ['#gatil', 'O gatil'],
  ['#instagram', 'Instagram'],
  ['#visite', 'Como chegar'],
];

export default function Rodape() {
  const { endereco, funcionamento, contato, marca, gatil } = CONFIG;
  const whatsapp = linkWhatsapp();
  const ano = new Date().getFullYear();

  return (
    <footer className="rodape">
      <div className="container">
        <div className="rodape__chamada">
          <p className="rodape__chamada-texto">Te vemos no gatil? 🐾</p>
          <div className="rodape__chamada-acoes">
            <a className="botao" href="#gatil">Conhecer o gatil</a>
            <a className="botao botao--claro" href={linkInstagram()} target="_blank" rel="noopener noreferrer">
              <IconeInstagram /> @{contato.instagram}
            </a>
            {whatsapp && (
              <a className="botao botao--claro" href={whatsapp} target="_blank" rel="noopener noreferrer"><IconeWhatsapp /> WhatsApp</a>
            )}
          </div>
        </div>

        <ul className="rodape__faixa">
          <li className="rodape__info">
            <IconeMapa className="rodape__icone" />
            <div>
              <p className="rodape__destaque">{endereco.linha1}</p>
              <p>{endereco.linha2}</p>
              <a className="rodape__link-seta" href="#visite">Como chegar →</a>
            </div>
          </li>
          <li className="rodape__info">
            <IconeRelogio className="rodape__icone" />
            <div>
              <p className="rodape__destaque">{funcionamento[0].dias} · {funcionamento[0].horarios.join(' e ')}</p>
              {funcionamento.slice(1).map((f) => <p key={f.dias}>{f.dias}: {f.horarios.join(' e ')}</p>)}
              <StatusFuncionamento />
            </div>
          </li>
          <li className="rodape__info">
            <IconePatinha className="rodape__icone" />
            <div>
              <p className="rodape__destaque">Área dos gatos</p>
              <p>Sessões de {Object.keys(gatil.precosCentavos).join(' ou ')} minutos, com reserva no balcão. {marca.pioneiro}, desde {marca.fundacao}.</p>
              <a className="rodape__link-seta" href="#gatil">Ver regras e preços →</a>
            </div>
          </li>
        </ul>

        <nav className="rodape__nav" aria-label="Rodapé">
          <ul>
            {LINKS.map(([href, texto]) => <li key={href}><a href={href}>{texto}</a></li>)}
          </ul>
        </nav>

        <div className="rodape__base">
          <p>© {ano} {marca.nome} · Feito com 🍵 em São Paulo</p>
          <a href="#conteudo">Voltar ao topo ↑</a>
        </div>
      </div>
    </footer>
  );
}
