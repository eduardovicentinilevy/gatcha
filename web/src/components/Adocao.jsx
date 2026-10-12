import { useEffect, useState } from 'react';
import { CONFIG } from '../config.js';
import { carregarGatos } from '../api.js';
import { idade } from '../util.js';
import Carrossel from './Carrossel.jsx';
import Foto from './Foto.jsx';

const STATUS = {
  disponivel: ['Disponível', 'selo--matcha'],
  em_processo: ['Em processo de adoção', 'selo--destaque'],
};
const TONS = ['matcha', 'creme', 'rosa'];
const tags = (texto) => (texto ?? '').split(',').map((t) => t.trim()).filter(Boolean);

export default function Adocao() {
  const [gatos, setGatos] = useState(null);
  const [exemplo, setExemplo] = useState(false);

  const [falhou, setFalhou] = useState(false);
  const [tentativa, setTentativa] = useState(0);

  useEffect(() => {
    let vivo = true;
    setFalhou(false);
    carregarGatos()
      .then(({ lista, exemplo }) => {
        if (!vivo) return;
        setGatos(lista.filter((g) => g.status !== 'adotado'));
        setExemplo(exemplo);
      })
      .catch(() => vivo && setFalhou(true));
    return () => {
      vivo = false;
    };
  }, [tentativa]);

  return (
    <section id="adocao" className="secao" aria-labelledby="titulo-adocao">
      <div className="container">
        <header className="secao__topo" data-revelar>
          <p className="sobretitulo">Adoção</p>
          <h2 id="titulo-adocao">{CONFIG.textos.adocao.titulo}</h2>
          <p>{CONFIG.textos.adocao.subtitulo}</p>
        </header>

        {falhou && (
          <div className="vazio" role="alert">
            <p>Não deu pra carregar agora. Confere a internet?</p>
            <button type="button" className="botao" onClick={() => setTentativa((t) => t + 1)}>Tentar de novo</button>
          </div>
        )}
        {!gatos && !falhou && <div className="esqueleto esqueleto--card" />}
        {gatos?.length === 0 && <p className="vazio">Todo mundo foi adotado! 🎉 Volta logo pra conhecer os novos moradores.</p>}
        {gatos?.length > 0 && (
          <Carrossel
            rotulo="Gatos para adoção"
            itens={gatos}
            chave={(g) => g.id}
            classe="carrossel--gatos"
            renderItem={(g, i) => (
              <article className="gato cartao cartao--interativo">
                <div className="midia">
                  <Foto src={g.foto_url} alt={`Foto de ${g.nome}`} icone="gato" tom={TONS[i % TONS.length]} />
                  {STATUS[g.status] && <span className={`selo selo--adesivo ${STATUS[g.status][1]}`}>{STATUS[g.status][0]}</span>}
                </div>
                <div className="gato__corpo">
                  <h3>{g.nome}</h3>
                  <p className="gato__meta">{[idade(g.idade_meses), g.sexo === 'femea' ? 'fêmea' : 'macho'].filter(Boolean).join(' · ')}</p>
                  <ul className="tags" aria-label="Personalidade">
                    {tags(g.personalidade).map((t) => <li key={t} className="tag">{t}</li>)}
                  </ul>
                </div>
              </article>
            )}
          />
        )}
        {exemplo && <p className="nota">Galeria ilustrativa: em breve, os gatos reais do Abrigo São Gabriel.</p>}

        <div className="ong cartao" data-revelar>
          <p className="ong__titulo">🤝 Parceria com o Abrigo São Gabriel</p>
          <p>
            A gente cuida do dia a dia no gatil; a ONG cuida da adoção responsável: entrevista, termo e acompanhamento.
            Se apaixonou por algum gato? Venha conhecer no gatil e fale com a equipe no balcão.
          </p>
        </div>
      </div>
    </section>
  );
}

