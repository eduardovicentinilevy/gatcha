import LogoGato from './LogoGato.jsx';

export default function Rodape() {
  return (
    <footer className="rodape">
      <div className="container rodape__grade">
        <a className="marca marca--clara" href="/"><LogoGato tamanho={32} /><span>Gatchá</span></a>
        <p>Cat café de matchá desde 2022 · Gatos para adoção com a ONG Abrigo São Gabriel</p>
        <a href="/privacidade">Aviso de privacidade</a>
      </div>
    </footer>
  );
}
