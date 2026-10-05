import { CONFIG, linkInstagram, linkWhatsapp } from '../config.js';
import LogoGato from './LogoGato.jsx';

export default function Rodape() {
  const { endereco, funcionamento, contato, desenvolvedor, marca } = CONFIG;
  const whatsapp = linkWhatsapp();
  return (
    <footer className="rodape">
      <div className="container rodape__grade">
        <div>
          <a className="marca" href="/"><LogoGato tamanho={36} /><span>{marca.nome}</span></a>
          <p>{marca.slogan}, desde {marca.fundacao}. Gatos para adoção com o Abrigo São Gabriel.</p>
        </div>
        <div>
          <h2 className="rodape__titulo">Endereço</h2>
          <p>{endereco.linha1}<br />{endereco.linha2}</p>
        </div>
        <div>
          <h2 className="rodape__titulo">Horários</h2>
          {funcionamento.map((f) => <p key={f.dias}>{f.dias}: {f.horario}</p>)}
        </div>
        <div>
          <h2 className="rodape__titulo">Redes</h2>
          <p><a href={linkInstagram()} target="_blank" rel="noopener noreferrer">Instagram @{contato.instagram}</a></p>
          {whatsapp && <p><a href={whatsapp} target="_blank" rel="noopener noreferrer">WhatsApp</a></p>}
          <p><a href="/privacidade">Aviso de privacidade</a></p>
        </div>
      </div>
      <p className="container rodape__credito">
        © {new Date().getFullYear()} {marca.nome} · Site por{' '}
        {desenvolvedor.url ? <a href={desenvolvedor.url} target="_blank" rel="noopener noreferrer">{desenvolvedor.nome}</a> : desenvolvedor.nome}
      </p>
    </footer>
  );
}
