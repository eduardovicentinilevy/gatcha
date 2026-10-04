import { useEffect, useMemo, useState } from 'react';
import { api } from '../api.js';
import { CARDAPIO_EXEMPLO } from '../dados-exemplo.js';
import { reais } from '../util.js';

export default function Cardapio() {
  const [itens, setItens] = useState(null);
  const [exemplo, setExemplo] = useState(false);
  const [ativa, setAtiva] = useState('Todos');

  useEffect(() => {
    const controle = new AbortController();
    api
      .cardapio(controle.signal)
      .then(({ itens }) => setItens(itens))
      .catch(() => {
        if (controle.signal.aborted) return;
        setItens(CARDAPIO_EXEMPLO);
        setExemplo(true);
      });
    return () => controle.abort();
  }, []);

  const categorias = useMemo(() => ['Todos', ...new Set((itens ?? []).map((i) => i.categoria))], [itens]);
  const visiveis = ativa === 'Todos' ? itens : itens?.filter((i) => i.categoria === ativa);

  return (
    <section id="cardapio" className="secao" aria-labelledby="titulo-cardapio">
      <div className="container">
        <header className="secao__topo">
          <p className="sobretitulo">Cardápio</p>
          <h2 id="titulo-cardapio">Do matchá cerimonial ao pão de queijo</h2>
        </header>
        <div className="filtros" role="group" aria-label="Filtrar por categoria">
          {itens && categorias.map((c) => (
            <button key={c} type="button" className="chip" aria-pressed={c === ativa} onClick={() => setAtiva(c)}>{c}</button>
          ))}
        </div>
        <ul className="cardapio" aria-live="polite">
          {visiveis
            ? visiveis.map((i) => (
                <li key={i.id} className="item">
                  <span className="item__nome">{i.nome}</span>
                  <span className="item__preco">{reais(i.preco_centavos)}</span>
                  {i.descricao && <p className="item__desc">{i.descricao}</p>}
                </li>
              ))
            : [1, 2, 3, 4].map((n) => <li key={n} className="esqueleto" />)}
        </ul>
        {exemplo && <p className="nota">Prévia do cardápio com itens ilustrativos. Preços e sabores podem mudar.</p>}
      </div>
    </section>
  );
}
