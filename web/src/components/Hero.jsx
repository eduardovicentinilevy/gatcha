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

/**
 * Geometria do anel de texto (unidades do viewBox 0 0 200 200). Com o carimbo "1º", o texto
 * ocupa só `arco` graus e começa `inicio` graus antes das 9h; o vão que sobra fica embaixo, à
 * esquerda, e o carimbo é posicionado no meio dele a partir destes mesmos números (nada de
 * medida solta no CSS). Sem o carimbo, o texto dá a volta inteira.
 */
const ANEL = { raio: 86, inicio: -10, arco: 290, carimbo: 70 };
const CIRCUNFERENCIA = 2 * Math.PI * ANEL.raio;
const ANEL_INTEIRO = 'Matchá • Gatos • República • Galeria Metrópole • ';

/** Centro do vão (ângulo no sentido horário a partir das 12h) e onde o carimbo fica, em % do selo. */
function posicaoDoCarimbo() {
  const angulo = ((270 + ANEL.inicio - (360 - ANEL.arco) / 2) * Math.PI) / 180;
  const x = 100 + ANEL.raio * Math.sin(angulo);
  const y = 100 - ANEL.raio * Math.cos(angulo);
  const pct = (v) => `${((v - ANEL.carimbo / 2) / 2).toFixed(2)}%`;
  return { '--carimbo-x': pct(x), '--carimbo-y': pct(y), '--carimbo-tam': `${ANEL.carimbo / 2}%` };
}
const ESTILO_DO_CARIMBO = posicaoDoCarimbo();

export default function Hero() {
  const t = CONFIG.textos.hero;
  const { pioneiro } = CONFIG;
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
              <path id="hero-anel" d={`M100 100m-${ANEL.raio} 0a${ANEL.raio} ${ANEL.raio} 0 1 1 ${2 * ANEL.raio} 0a${ANEL.raio} ${ANEL.raio} 0 1 1-${2 * ANEL.raio} 0`} fill="none" />
              {pioneiro ? (
                <text transform={`rotate(${ANEL.inicio} 100 100)`}>
                  <textPath href="#hero-anel" textLength={((CIRCUNFERENCIA * ANEL.arco) / 360).toFixed(1)} lengthAdjust="spacing">{pioneiro.frase.toUpperCase()}</textPath>
                </text>
              ) : (
                <text><textPath href="#hero-anel" textLength={(CIRCUNFERENCIA - 2).toFixed(1)} lengthAdjust="spacing">{ANEL_INTEIRO.toUpperCase()}</textPath></text>
              )}
            </svg>
            <div className="hero__logo"><LogoGato tamanho={260} vivo /></div>
            {/* Carimbo decorativo: a frase completa está no selo acima do título, para leitores de tela */}
            {pioneiro && (
              <p className="hero__carimbo" style={ESTILO_DO_CARIMBO}><strong>{pioneiro.carimbo[0]}</strong> {pioneiro.carimbo[1]}</p>
            )}
          </div>
          <IconePatinha className="hero__patinha hero__patinha--1" />
          <IconePatinha className="hero__patinha hero__patinha--2" />
        </div>
      </div>
    </section>
  );
}
