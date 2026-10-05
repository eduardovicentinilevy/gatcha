import { useEffect, useState } from 'react';
import { CONFIG } from '../config.js';
import { carregarCardapio, carregarGatos } from '../api.js';
import { agoraNoCafe, idade, reais } from '../util.js';
import Carrossel from './Carrossel.jsx';
import Foto from './Foto.jsx';
import LogoGato from './LogoGato.jsx';
import { IconePatinha } from './Icones.jsx';

/** Monta os destaques: gato do dia (muda a cada dia), bebida destaque e aviso de adoção. */
async function montarDestaques() {
  const [{ lista: gatos }, { lista: itens }] = await Promise.all([carregarGatos(), carregarCardapio()]);
  const destaques = [];

  const disponiveis = gatos.filter((g) => g.status === 'disponivel');
  if (disponiveis.length) {
    const dia = Number(agoraNoCafe().data.replaceAll('-', ''));
    const g = disponiveis[dia % disponiveis.length];
    destaques.push({
      id: 'gato',
      selo: 'Gato do dia',
      titulo: `${g.nome}, ${idade(g.idade_meses)}`,
      texto: g.personalidade,
      foto: { src: g.foto_url, alt: `Foto de ${g.nome}, gato para adoção`, icone: 'gato', tom: 'matcha' },
      link: ['#adocao', `Conhecer ${g.nome}`],
    });
  }

  const ativos = itens.filter((i) => i.ativo);
  const bebida = ativos.find((i) => i.selos?.includes('mais_pedido') && i.categoria === 'Matchás') ?? ativos[0];
  if (bebida) {
    destaques.push({
      id: 'bebida',
      selo: 'Mais pedido',
      titulo: bebida.nome,
      texto: `${bebida.descricao} ${reais(bebida.preco_centavos)}.`,
      foto: { src: bebida.foto_url, alt: `Foto de ${bebida.nome}`, icone: 'xicara', tom: 'creme' },
      link: ['#cardapio', 'Ver cardápio'],
    });
  }

  destaques.push({
    id: 'adocao',
    selo: 'Adoção',
    titulo: CONFIG.destaqueAdocao.titulo,
    texto: CONFIG.destaqueAdocao.texto,
    foto: { alt: 'Ilustração de patinha de gato', icone: 'patinha', tom: 'rosa' },
    link: ['#adocao', 'Ver gatos para adoção'],
  });
  return destaques;
}

export default function Hero() {
  const t = CONFIG.textos.hero;
  const [destaques, setDestaques] = useState(null);

  useEffect(() => {
    let ativo = true;
    montarDestaques().then((d) => ativo && setDestaques(d)).catch(() => ativo && setDestaques([]));
    return () => {
      ativo = false;
    };
  }, []);

  return (
    <section id="inicio" className="hero">
      <div className="container hero__grade">
        <div className="hero__texto" data-revelar>
          <p className="selo selo--escuro">{t.selo}</p>
          <h1>{t.titulo}</h1>
          <p className="hero__sub">{t.subtitulo}</p>
          <div className="hero__acoes">
            <a className="botao botao--grande" href="#reserva">Reservar gatil</a>
            <a className="botao botao--grande botao--claro" href="#cardapio">Ver cardápio</a>
          </div>
        </div>
        <div className="hero__arte" aria-hidden="true" data-revelar>
          <div className="hero__logo"><LogoGato tamanho={260} /></div>
          <IconePatinha className="hero__patinha hero__patinha--1" />
          <IconePatinha className="hero__patinha hero__patinha--2" />
        </div>
      </div>

      <div className="container hero__destaques" data-revelar>
        {destaques === null ? (
          <div className="esqueleto esqueleto--destaque" />
        ) : (
          destaques.length > 0 && (
            <Carrossel
              rotulo="Destaques"
              itens={destaques}
              chave={(d) => d.id}
              classe="carrossel--destaques"
              renderItem={(d) => (
                <article className="destaque cartao">
                  <Foto {...d.foto} proporcao="1/1" className="destaque__foto" />
                  <div className="destaque__corpo">
                    <p className="selo">{d.selo}</p>
                    <h2 className="destaque__titulo">{d.titulo}</h2>
                    <p>{d.texto}</p>
                    <a className="link" href={d.link[0]}>{d.link[1]} →</a>
                  </div>
                </article>
              )}
            />
          )
        )}
      </div>
    </section>
  );
}
