import { useEffect, useMemo, useState } from 'react';
import { CONFIG } from '../config.js';
import { carregarCardapio } from '../api.js';
import { normalizarBusca, reais } from '../util.js';
import Foto from './Foto.jsx';
import { IconeBusca } from './Icones.jsx';

const SELOS = {
  mais_pedido: ['Mais pedido', 'selo--destaque'],
  vegano: ['Vegano', 'selo--matcha'],
  novo: ['Novo', 'selo--rosa'],
};
const ORDEM_CATEGORIAS = ['Matchás', 'Cafés', 'Doces', 'Salgados'];

export default function Cardapio() {
  const [itens, setItens] = useState(null);
  const [exemplo, setExemplo] = useState(false);
  const [ativa, setAtiva] = useState('Tudo');
  const [busca, setBusca] = useState('');

  const [falhou, setFalhou] = useState(false);
  const [tentativa, setTentativa] = useState(0);

  useEffect(() => {
    let vivo = true;
    setFalhou(false);
    carregarCardapio()
      .then(({ lista, exemplo }) => {
        if (!vivo) return;
        setItens(lista.filter((i) => i.ativo));
        setExemplo(exemplo);
      })
      .catch(() => vivo && setFalhou(true));
    return () => {
      vivo = false;
    };
  }, [tentativa]);

  const categorias = useMemo(() => {
    const presentes = [...new Set((itens ?? []).map((i) => i.categoria))];
    presentes.sort((a, b) => (ORDEM_CATEGORIAS.indexOf(a) + 1 || 99) - (ORDEM_CATEGORIAS.indexOf(b) + 1 || 99));
    return ['Tudo', ...presentes];
  }, [itens]);

  const termo = normalizarBusca(busca);
  const visiveis = (itens ?? []).filter(
    (i) => (ativa === 'Tudo' || i.categoria === ativa) && (!termo || normalizarBusca(i.nome).includes(termo)),
  );

  return (
    <section id="cardapio" className="secao" aria-labelledby="titulo-cardapio">
      <div className="container">
        <header className="secao__topo" data-revelar>
          <p className="sobretitulo">Cardápio</p>
          <h2 id="titulo-cardapio">{CONFIG.textos.cardapio.titulo}</h2>
          <p>{CONFIG.textos.cardapio.subtitulo}</p>
        </header>

        <div className="cardapio__filtros">
          <div className="filtros" role="group" aria-label="Filtrar por categoria">
            {itens && categorias.map((c) => (
              <button key={c} type="button" className="chip" aria-pressed={c === ativa} onClick={() => setAtiva(c)}>{c}</button>
            ))}
          </div>
          <label className="busca">
            <IconeBusca />
            <span className="sr">Buscar no cardápio</span>
            <input type="search" placeholder="Buscar: matchá, cookie…" value={busca} onChange={(e) => setBusca(e.target.value)} maxLength={40} />
          </label>
        </div>

        <p className="sr" aria-live="polite">{itens ? `${visiveis.length} itens encontrados` : ''}</p>
        <ul className="cardapio">
          {!itens && !falhou && [1, 2, 3, 4].map((n) => <li key={n} className="esqueleto esqueleto--card" />)}
          {visiveis.map((i) => (
            <li key={i.id} className="item cartao cartao--interativo">
              <Foto src={i.foto_url} alt={`Foto de ${i.nome}`} icone={i.categoria === 'Matchás' || i.categoria === 'Cafés' ? 'xicara' : 'patinha'} tom={i.categoria === 'Matchás' ? 'matcha' : 'creme'} />
              <div className="item__corpo">
                <h3 className="item__nome">{i.nome}</h3>
                {i.descricao && <p className="item__desc">{i.descricao}</p>}
                <div className="item__rodape">
                  <p className="item__preco">{reais(i.preco_centavos)}</p>
                  {i.selos?.length > 0 && (
                    <ul className="selos" aria-label="Selos">
                      {i.selos.filter((s) => SELOS[s]).map((s) => <li key={s} className={`selo ${SELOS[s][1]}`}>{SELOS[s][0]}</li>)}
                    </ul>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
        {falhou && (
          <div className="vazio" role="alert">
            <p>Não deu pra carregar agora. Confere a internet?</p>
            <button type="button" className="botao" onClick={() => setTentativa((t) => t + 1)}>Tentar de novo</button>
          </div>
        )}
        {itens && visiveis.length === 0 && (
          <p className="vazio">Nada com “{busca}” por aqui. Que tal um matchá latte? 🍵</p>
        )}
        {exemplo && <p className="nota">Cardápio ilustrativo: preços e sabores podem mudar.</p>}
      </div>
    </section>
  );
}
