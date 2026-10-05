import { useEffect, useState } from 'react';
import { CONFIG, linkInstagram } from '../config.js';
import { carregarCardapio, carregarGatos } from '../api.js';
import { agoraNoCafe, idade, reais } from '../util.js';
import Carrossel from './Carrossel.jsx';
import Foto from './Foto.jsx';
import LogoGato from './LogoGato.jsx';
import { IconePatinha } from './Icones.jsx';

/**
 * Monta os destaques do topo a partir dos dados (gatos e cardápio) e do config:
 * gato do dia, mais pedido, novidade, opção vegana, gatil, adoção e Instagram.
 */
/** "descrição R$ 22,00." sem "null" quando a descrição não existe. */
const textoItem = (i) => [i.descricao, `${reais(i.preco_centavos)}.`].filter(Boolean).join(' ');

async function montarDestaques() {
  // allSettled: se um dos dois falhar, os outros destaques (gatil, adoção, Instagram) continuam aparecendo.
  const [rGatos, rItens] = await Promise.allSettled([carregarGatos(), carregarCardapio()]);
  const gatos = rGatos.status === 'fulfilled' ? rGatos.value.lista : [];
  const itens = rItens.status === 'fulfilled' ? rItens.value.lista : [];
  const destaques = [];

  const disponiveis = gatos.filter((g) => g.status === 'disponivel');
  if (disponiveis.length) {
    const dia = Number(agoraNoCafe().data.replaceAll('-', ''));
    const g = disponiveis[dia % disponiveis.length];
    destaques.push({
      id: 'gato',
      selo: 'Gato do dia',
      titulo: [g.nome, idade(g.idade_meses)].filter(Boolean).join(', '),
      texto: g.personalidade ?? '',
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
      texto: textoItem(bebida),
      foto: { src: bebida.foto_url, alt: `Foto de ${bebida.nome}`, icone: 'xicara', tom: 'creme' },
      link: ['#cardapio', 'Ver cardápio'],
    });
  }

  const novidade = ativos.find((i) => i.selos?.includes('novo') && i.id !== bebida?.id);
  if (novidade) {
    destaques.push({
      id: 'novidade',
      selo: 'Novidade',
      titulo: novidade.nome,
      texto: textoItem(novidade),
      foto: { src: novidade.foto_url, alt: `Foto de ${novidade.nome}`, icone: 'xicara', tom: 'rosa' },
      link: ['#cardapio', 'Provar a novidade'],
    });
  }

  const vegano = ativos.find((i) => i.selos?.includes('vegano') && ['Doces', 'Salgados'].includes(i.categoria));
  if (vegano) {
    destaques.push({
      id: 'vegano',
      selo: 'Opção vegana',
      titulo: vegano.nome,
      texto: textoItem(vegano),
      foto: { src: vegano.foto_url, alt: `Foto de ${vegano.nome}`, icone: 'patinha', tom: 'matcha' },
      link: ['#cardapio', 'Ver itens veganos'],
    });
  }

  const { precosCentavos } = CONFIG.gatil;
  destaques.push({
    id: 'gatil',
    selo: 'Gatil',
    titulo: `A partir de ${reais(Math.min(...Object.values(precosCentavos)))}`,
    texto: `Sessões de ${Object.keys(precosCentavos).join(' ou ')} minutos com os gatos. Reserva em menos de 1 minuto, pagamento no local.`,
    foto: { alt: 'Ilustração de gato', icone: 'gato', tom: 'creme' },
    link: ['#reserva', 'Reservar horário'],
  });

  destaques.push({
    id: 'adocao',
    selo: 'Adoção',
    titulo: CONFIG.destaqueAdocao.titulo,
    texto: CONFIG.destaqueAdocao.texto,
    foto: { alt: 'Ilustração de patinha de gato', icone: 'patinha', tom: 'rosa' },
    link: ['#adocao', 'Ver gatos para adoção'],
  });

  destaques.push({
    id: 'instagram',
    selo: `@${CONFIG.contato.instagram}`,
    titulo: 'Bastidores e gato novo',
    texto: 'Siga a gente pra saber quem chegou no gatil e qual é o matchá do dia.',
    foto: { alt: 'Ilustração de xícara de matchá', icone: 'xicara', tom: 'matcha' },
    link: [linkInstagram(), 'Seguir no Instagram', true],
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
                    <a className="link" href={d.link[0]} {...(d.link[2] && { target: '_blank', rel: 'noopener noreferrer' })}>{d.link[1]} →</a>
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
