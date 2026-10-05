import { CONFIG, linkInstagram, linkWhatsapp } from '../config.js';
import LogoGato from './LogoGato.jsx';
import { IconeInstagram, IconeMapa, IconeWhatsapp } from './Icones.jsx';

const LINKS = [
  ['/#cardapio', 'Cardápio'],
  ['/#reserva', 'Reservar gatil'],
  ['/#adocao', 'Adoção'],
  ['/#visite', 'Como chegar'],
  ['/privacidade', 'Aviso de privacidade'],
];

export default function Rodape() {
  const { endereco, funcionamento, contato, desenvolvedor, marca } = CONFIG;
  const whatsapp = linkWhatsapp();
  const ano = new Date().getFullYear();

  return (
    <footer className="rodape">
      <div className="container">
        <div className="rodape__chamada">
          <p className="rodape__chamada-texto">Te vemos no gatil? 🐾</p>
          <div className="rodape__chamada-acoes">
            <a className="botao" href="/#reserva">Reservar gatil</a>
            <a className="botao botao--claro" href={linkInstagram()} target="_blank" rel="noopener noreferrer">
              <IconeInstagram /> @{contato.instagram}
            </a>
            {whatsapp && (
              <a className="botao botao--claro" href={whatsapp} target="_blank" rel="noopener noreferrer"><IconeWhatsapp /> WhatsApp</a>
            )}
          </div>
        </div>

        <div className="rodape__grade">
          <div className="rodape__marca">
            <a className="marca" href="/"><LogoGato tamanho={44} /><span>{marca.nome}</span></a>
            <p>{marca.slogan}, desde {marca.fundacao}. Gatos para adoção com o Abrigo São Gabriel.</p>
          </div>

          <div>
            <h2 className="rodape__titulo">Visite</h2>
            <address className="rodape__endereco">
              <IconeMapa />
              <span>{endereco.linha1}<br />{endereco.linha2}</span>
            </address>
          </div>

          <div>
            <h2 className="rodape__titulo">Horários</h2>
            <dl className="rodape__horarios">
              {funcionamento.map((f) => (
                <div key={f.dias}><dt>{f.dias}</dt><dd>{f.horario}</dd></div>
              ))}
            </dl>
          </div>

          <nav aria-label="Rodapé">
            <h2 className="rodape__titulo">Atalhos</h2>
            <ul className="rodape__links">
              {LINKS.map(([href, texto]) => <li key={href}><a href={href}>{texto}</a></li>)}
            </ul>
          </nav>
        </div>

        <div className="rodape__base">
          <p>© {ano} {marca.nome} · Feito com 🍵 em São Paulo</p>
          <p>
            Site por{' '}
            {desenvolvedor.url ? <a href={desenvolvedor.url} target="_blank" rel="noopener noreferrer">{desenvolvedor.nome}</a> : desenvolvedor.nome}
            {' · '}
            <a href="#conteudo">Voltar ao topo ↑</a>
          </p>
        </div>
      </div>
    </footer>
  );
}
