import Topo from './components/Topo.jsx';
import Hero from './components/Hero.jsx';
import Cardapio from './components/Cardapio.jsx';
import Gatil from './components/Gatil.jsx';
import Adocao from './components/Adocao.jsx';
import Visite from './components/Visite.jsx';
import Rodape from './components/Rodape.jsx';
import Privacidade from './components/Privacidade.jsx';

/** Duas páginas apenas: não justifica um roteador. O Firebase reescreve tudo para o index.html. */
export default function App() {
  const pagina = window.location.pathname.replace(/\/+$/, '') === '/privacidade' ? 'privacidade' : 'inicio';

  return (
    <>
      <a className="pular" href="#conteudo">Pular para o conteúdo</a>
      <Topo comMenu={pagina === 'inicio'} />
      {pagina === 'privacidade' ? (
        <Privacidade />
      ) : (
        <main id="conteudo">
          <Hero />
          <Cardapio />
          <Gatil />
          <Adocao />
          <Visite />
        </main>
      )}
      <Rodape />
    </>
  );
}
