import { useEffect, useState } from 'react';
import { CONFIG } from '../config.js';
import { carregarAvaliacoes } from '../api.js';
import { IconeEstrela } from './Icones.jsx';

const MAX_GOOGLE = 3;
const formatarNota = (n) => n.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

function Estrelas({ nota }) {
  return (
    <p className="estrelas" role="img" aria-label={`${nota} de 5 estrelas`}>
      {Array.from({ length: 5 }, (_, i) => <IconeEstrela key={i} className={i < Math.round(nota) ? 'cheia' : ''} />)}
    </p>
  );
}

/**
 * Avaliações: do Google Maps quando o backend tem a Places API configurada,
 * senão as de exemplo do config. Regras de exibição do Google respeitadas:
 * nome do autor (com link para o perfil), texto sem edição (só abreviado
 * visualmente, com link para a avaliação completa) e atribuição ao Google.
 */
export default function Avaliacoes() {
  const [google, setGoogle] = useState(null);

  useEffect(() => {
    const controle = new AbortController();
    carregarAvaliacoes(controle.signal).then((d) => !controle.signal.aborted && d?.disponivel && d.avaliacoes.length && setGoogle(d));
    return () => controle.abort();
  }, []);

  const lista = google
    ? google.avaliacoes.slice(0, MAX_GOOGLE)
    : CONFIG.avaliacoes.map((a) => ({ autor: a.nome, texto: a.texto, nota: a.nota, quando: a.fonte && `via ${a.fonte}` }));

  return (
    <section className="secao secao--creme" aria-labelledby="titulo-avaliacoes">
      <div className="container">
        <header className="secao__topo" data-revelar>
          <p className="sobretitulo">Avaliações</p>
          <h2 id="titulo-avaliacoes">{CONFIG.textos.avaliacoes.titulo}</h2>
          {google?.nota_media && (
            <p className="avaliacoes__resumo">
              <strong>{formatarNota(google.nota_media)}</strong>
              <Estrelas nota={google.nota_media} />
              <span>{google.total ? `${google.total.toLocaleString('pt-BR')} avaliações no Google` : 'no Google'}</span>
            </p>
          )}
        </header>
        <ul className="avaliacoes">
          {lista.map((a, i) => (
            <li key={`${a.autor}-${i}`} className="avaliacao cartao" data-revelar>
              {a.nota && <Estrelas nota={a.nota} />}
              <blockquote>
                <p className={google ? 'avaliacao__texto--abreviado' : undefined}>“{a.texto}”</p>
              </blockquote>
              {google && a.link && (
                <a className="link avaliacao__mais" href={a.link} target="_blank" rel="noopener noreferrer">Ler no Google</a>
              )}
              <p className="avaliacao__autor">
                <span className="avaliacao__inicial" aria-hidden="true">{a.autor.trim()[0]}</span>
                <span>
                  {a.autor_url ? <a href={a.autor_url} target="_blank" rel="noopener noreferrer">{a.autor}</a> : a.autor}
                  {a.quando && <small className="avaliacao__quando">{a.quando}</small>}
                </span>
              </p>
            </li>
          ))}
        </ul>
        {google && (
          <p className="avaliacoes__fonte">
            Avaliações do Google
            {google.link_maps && (
              <>
                {' · '}
                <a className="link" href={google.link_maps} target="_blank" rel="noopener noreferrer">Ver todas no Google Maps</a>
              </>
            )}
          </p>
        )}
      </div>
    </section>
  );
}
