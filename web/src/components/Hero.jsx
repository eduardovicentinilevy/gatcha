import { CONFIG } from '../config.js';
import LogoGato from './LogoGato.jsx';
import StatusFuncionamento from './Status.jsx';
import { IconePatinha } from './Icones.jsx';

/** Título com uma palavra destacada (CONFIG.textos.hero.tituloDestaque). */
function Titulo({ texto, destaque }) {
  const i = destaque ? texto.indexOf(destaque) : -1;
  if (i < 0) return texto;
  return (
    <>
      {texto.slice(0, i)}
      <span className="hero__destaque">{destaque}</span>
      {texto.slice(i + destaque.length)}
    </>
  );
}

/* O texto ocupa 290° do anel (textLength) e começa um pouco abaixo das 9h (rotate -10°):
   sobra um vão embaixo, à esquerda, onde fica o carimbo "1º", sem cobrir nenhuma letra. */
const TEXTO_DO_ANEL = 'O primeiro cat café de São Paulo';

export default function Hero() {
  const t = CONFIG.textos.hero;
  const [cafe] = CONFIG.funcionamento;

  return (
    <section id="inicio" className="hero">
      <div className="container hero__grade">
        <div className="hero__texto" data-revelar>
          <p className="selo selo--pioneiro">{t.selo}</p>
          <h1><Titulo texto={t.titulo} destaque={t.tituloDestaque} /></h1>
          <p className="hero__sub">{t.subtitulo}</p>
          <div className="hero__acoes">
            <a className="botao botao--grande" href="#gatil">Conhecer o gatil</a>
            <a className="botao botao--grande botao--claro" href="#visite">Como chegar</a>
          </div>
          <p className="hero__status">
            <StatusFuncionamento />
            <span>{cafe.dias}, {cafe.horarios.join(' e ')}</span>
          </p>
        </div>
        <div className="hero__arte" aria-hidden="true" data-revelar>
          <div className="hero__selo">
            <svg className="hero__anel" viewBox="0 0 200 200">
              <path id="hero-anel" d="M100 100m-86 0a86 86 0 1 1 172 0a86 86 0 1 1-172 0" fill="none" />
              <text transform="rotate(-10 100 100)"><textPath href="#hero-anel" textLength="435" lengthAdjust="spacing">{TEXTO_DO_ANEL.toUpperCase()}</textPath></text>
            </svg>
            <div className="hero__logo"><LogoGato tamanho={260} vivo /></div>
            {/* Carimbo "1º cat café de SP" (a frase completa está no selo acima do título, para leitores de tela) */}
            <p className="hero__carimbo"><strong>1º</strong> cat café de SP</p>
          </div>
          <IconePatinha className="hero__patinha hero__patinha--1" />
          <IconePatinha className="hero__patinha hero__patinha--2" />
        </div>
      </div>
    </section>
  );
}
