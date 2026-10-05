/**
 * Reserva do gatil em etapas: 1 Dia → 2 Horário → 3 Duração e pessoas → 4 Seus dados → Confirmação.
 *
 * A API (ou o simulador do protótipo) decide as vagas de verdade; aqui só
 * exibimos. Se a vaga acabar no meio do caminho (409), voltamos para a etapa de
 * horário com a grade atualizada.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { CONFIG } from '../config.js';
import { api, ErroApi } from '../api.js';
import {
  diaDaSemana, focarPrimeiroErro, mascararTelefone, normalizarTelefone, paraMinutos, proximosDias, reais, RE_EMAIL, RE_NOME, rotuloDia,
} from '../util.js';
import Campo, { Aceite } from './Campo.jsx';
import LogoGato from './LogoGato.jsx';
import { IconePatinha } from './Icones.jsx';

const { gatil } = CONFIG;
const ETAPAS = ['Dia', 'Horário', 'Detalhes', 'Seus dados'];
const DADOS_VAZIOS = { nome: '', telefone: '', email: '', aceite: false };
const SEMANA = [['D', 'domingo'], ['S', 'segunda'], ['T', 'terça'], ['Q', 'quarta'], ['Q', 'quinta'], ['S', 'sexta'], ['S', 'sábado']];

function validar(d) {
  const e = {};
  const nome = d.nome.trim();
  if (nome.length < 2) e.nome = 'Como a gente te chama?';
  else if (!RE_NOME.test(nome)) e.nome = 'Use só letras, espaço, apóstrofo, ponto e hífen.';
  if (!/^[1-9]{2}\d{8,9}$/.test(normalizarTelefone(d.telefone))) e.telefone = 'Coloca o celular com DDD, tipo (11) 91234-5678.';
  if (!RE_EMAIL.test(d.email.trim())) e.email = 'Esse e-mail parece incompleto.';
  if (!d.aceite) e.aceite = 'Precisamos do seu ok pra usar esses dados na reserva.';
  return e;
}

export default function Reserva() {
  const [etapa, setEtapa] = useState(1); // 1..4, 5 = confirmada
  const [data, setData] = useState(null);
  const [grade, setGrade] = useState({ estado: 'ocioso' }); // ocioso | carregando | pronto | erro
  const [versaoGrade, setVersaoGrade] = useState(0);
  const [hora, setHora] = useState(null);
  const [duracao, setDuracao] = useState(15);
  const [pessoas, setPessoas] = useState(1);
  const [dados, setDados] = useState(DADOS_VAZIOS);
  const [tocados, setTocados] = useState({});
  const [errosServidor, setErrosServidor] = useState({});
  const [alerta, setAlerta] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const [confirmada, setConfirmada] = useState(null);

  const titulos = useRef([]);
  const primeiraRenderizacao = useRef(true);

  // Leva o foco (e a tela) para o título da etapa nova: essencial para leitor de tela e teclado.
  useEffect(() => {
    if (primeiraRenderizacao.current) {
      primeiraRenderizacao.current = false;
      return;
    }
    const titulo = titulos.current[etapa];
    titulo?.focus({ preventScroll: true });
    titulo?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }, [etapa]);

  // Carrega a grade do dia escolhido (e recarrega quando versaoGrade muda).
  useEffect(() => {
    if (!data) return undefined;
    const controle = new AbortController();
    setGrade({ estado: 'carregando' });
    api
      .horarios(data, controle.signal)
      .then((g) => !controle.signal.aborted && setGrade({ estado: 'pronto', ...g }))
      .catch((erro) => !controle.signal.aborted && setGrade({ estado: 'erro', mensagem: erro.message }));
    return () => controle.abort();
  }, [data, versaoGrade]);

  const slot = grade.horarios?.find((h) => h.hora_inicio === hora);
  const vagasPara = (d) => (slot ? (d === 30 ? slot.vagas_30min : slot.vagas_15min) : 0);
  const maxPessoas = Math.max(1, Math.min(gatil.maxPessoasPorReserva, vagasPara(duracao)));

  // Se a duração escolhida deixou de caber, ajusta duração e número de pessoas.
  useEffect(() => {
    if (!slot) return;
    if (duracao === 30 && slot.vagas_30min === 0) setDuracao(15);
    setPessoas((p) => Math.min(p, maxPessoas));
  }, [slot, duracao, maxPessoas]);

  const erros = useMemo(() => ({ ...validar(dados), ...errosServidor }), [dados, errosServidor]);
  const erroVisivel = (campo) => (tocados[campo] ? erros[campo] : undefined);
  const total = gatil.precosCentavos[duracao] * pessoas;
  const resumo = data && hora
    ? `${rotuloDia(data).longo}, ${hora} · ${duracao} min · ${pessoas === 1 ? '1 pessoa' : `${pessoas} pessoas`}`
    : '';

  function irPara(n) {
    setAlerta(null);
    setEtapa(n);
  }

  function escolherDia(iso) {
    if (iso !== data) {
      setData(iso);
      setHora(null);
    } else {
      setVersaoGrade((v) => v + 1); // mesmo dia: atualiza as vagas
    }
    irPara(2);
  }

  function escolherHora(h) {
    setHora(h);
    irPara(3);
  }

  const alterar = (e) => {
    const { name, type, checked, value } = e.target;
    const valor = type === 'checkbox' ? checked : name === 'telefone' ? mascararTelefone(value) : value;
    setDados((d) => ({ ...d, [name]: valor }));
    setErrosServidor(({ [name]: _removido, ...resto }) => resto);
    if (type === 'checkbox') setTocados((t) => ({ ...t, [name]: true }));
  };
  const marcarTocado = (e) => setTocados((t) => ({ ...t, [e.target.name]: true }));

  async function confirmar(evento) {
    evento.preventDefault();
    if (enviando) return; // evita reserva duplicada por duplo clique
    setAlerta(null);
    const errosAtuais = validar(dados);
    if (Object.keys(errosAtuais).length > 0) {
      setTocados({ nome: true, telefone: true, email: true, aceite: true });
      focarPrimeiroErro(evento.currentTarget, errosAtuais);
      return;
    }

    setEnviando(true);
    try {
      const { reserva } = await api.criarReserva({
        data,
        hora_inicio: hora,
        duracao_min: duracao,
        pessoas,
        nome: dados.nome.trim().replace(/\s+/g, ' '),
        telefone: normalizarTelefone(dados.telefone),
        email: dados.email.trim().toLowerCase(),
      });
      setConfirmada({ codigo: reserva.codigo, resumo, total });
      setEtapa(5);
    } catch (erro) {
      tratarErro(erro);
    } finally {
      setEnviando(false);
    }
  }

  function tratarErro(erro) {
    if (!(erro instanceof ErroApi)) {
      setAlerta('Não deu pra concluir a reserva. Tenta de novo?');
      return;
    }
    if (erro.codigo === 'DADOS_INVALIDOS') {
      const campos = erro.errosDeCampo;
      const doFormulario = Object.fromEntries(Object.entries(campos).filter(([k]) => k in DADOS_VAZIOS));
      setErrosServidor(doFormulario);
      setTocados((t) => ({ ...t, ...Object.fromEntries(Object.keys(doFormulario).map((k) => [k, true])) }));
      if (Object.keys(doFormulario).length === 0) setAlerta(Object.values(campos)[0] ?? erro.message);
      return;
    }
    // Vaga acabou, horário bloqueado ou já passou: volta para os horários atualizados.
    // (Outros 409, como LIMITE_DE_RESERVAS_ATIVAS, não têm a ver com o horário: ficam aqui com o aviso.)
    if (['VAGAS_INSUFICIENTES', 'HORARIO_BLOQUEADO'].includes(erro.codigo) || (erro.status === 400 && erro.codigo.startsWith('HORARIO'))) {
      setHora(null);
      setVersaoGrade((v) => v + 1);
      setEtapa(2);
    }
    setAlerta(erro.message);
  }

  function novaReserva() {
    setConfirmada(null);
    setDados(DADOS_VAZIOS);
    setTocados({});
    setHora(null);
    setPessoas(1);
    setDuracao(15);
    setVersaoGrade((v) => v + 1);
    setEtapa(1);
  }

  const refTitulo = (n) => (el) => {
    titulos.current[n] = el;
  };

  return (
    <div id="reserva" className="reserva cartao">
      {etapa <= 4 && <Progresso etapa={etapa} onIr={irPara} />}
      <p className="sr" aria-live="polite">{etapa <= 4 ? `Etapa ${etapa} de 4: ${ETAPAS[etapa - 1]}` : 'Reserva confirmada'}</p>

      {alerta && etapa <= 4 && <p className="alerta" role="alert">{alerta}</p>}

      {etapa === 1 && (
        <section className="etapa" aria-labelledby="etapa-1">
          <h3 id="etapa-1" ref={refTitulo(1)} tabIndex={-1}>Qual dia você vem?</h3>
          <Calendario selecionado={data} onEscolher={escolherDia} />
        </section>
      )}

      {etapa === 2 && (
        <section className="etapa" aria-labelledby="etapa-2">
          <h3 id="etapa-2" ref={refTitulo(2)} tabIndex={-1}>Que horas? <span className="etapa__contexto">{rotuloDia(data).longo}</span></h3>
          <Horarios grade={grade} hora={hora} onEscolher={escolherHora} onOutroDia={() => irPara(1)} />
          <div className="etapa__acoes">
            <button type="button" className="botao botao--secundario" onClick={() => irPara(1)}>Voltar</button>
          </div>
        </section>
      )}

      {etapa === 3 && slot && (
        <section className="etapa" aria-labelledby="etapa-3">
          <h3 id="etapa-3" ref={refTitulo(3)} tabIndex={-1}>Quanto tempo e quantas pessoas? <span className="etapa__contexto">{rotuloDia(data).curto}, {hora}</span></h3>
          <div className="duracoes" role="radiogroup" aria-label="Duração da sessão">
            {[15, 30].map((m) => {
              const vagas = vagasPara(m);
              return (
                <label key={m} className={`duracao${vagas === 0 ? ' duracao--indisponivel' : ''}`}>
                  <input type="radio" name="duracao" value={m} checked={duracao === m} disabled={vagas === 0} onChange={() => setDuracao(m)} />
                  <span className="duracao__tempo">{m} min</span>
                  <span className="duracao__preco">{reais(gatil.precosCentavos[m])} <small>por pessoa</small></span>
                  <span className="duracao__vagas">{vagas === 0 ? 'Não cabe nesse horário' : `${vagas} ${vagas === 1 ? 'vaga' : 'vagas'}`}</span>
                </label>
              );
            })}
          </div>

          <div className="pessoas">
            <span id="rotulo-pessoas" className="pessoas__rotulo">Pessoas</span>
            <div className="contador" role="group" aria-labelledby="rotulo-pessoas">
              <button type="button" className="botao-icone" aria-label="Menos uma pessoa" disabled={pessoas <= 1} onClick={() => setPessoas((p) => p - 1)}>−</button>
              <output aria-live="polite" aria-label={`${pessoas} ${pessoas === 1 ? 'pessoa' : 'pessoas'}`}>{pessoas}</output>
              <button type="button" className="botao-icone" aria-label="Mais uma pessoa" disabled={pessoas >= maxPessoas} onClick={() => setPessoas((p) => p + 1)}>+</button>
            </div>
            <p className="nota">
              {pessoas >= maxPessoas && maxPessoas < gatil.maxPessoasPorReserva
                ? `Só ${maxPessoas === 1 ? 'resta 1 vaga' : `restam ${maxPessoas} vagas`} nesse horário.`
                : `Até ${gatil.maxPessoasPorReserva} pessoas por reserva.`}
            </p>
          </div>

          <p className="total">Total no local: <strong>{reais(total)}</strong></p>
          <div className="etapa__acoes">
            <button type="button" className="botao botao--secundario" onClick={() => irPara(2)}>Voltar</button>
            <button type="button" className="botao" onClick={() => irPara(4)}>Continuar</button>
          </div>
        </section>
      )}

      {etapa === 4 && (
        <section className="etapa" aria-labelledby="etapa-4">
          <h3 id="etapa-4" ref={refTitulo(4)} tabIndex={-1}>Quase lá! Pra quem é a reserva?</h3>
          <form className="campos" noValidate onSubmit={confirmar}>
            <Campo id="r-nome" rotulo="Nome" name="nome" autoComplete="name" maxLength={100} value={dados.nome} onChange={alterar} onBlur={marcarTocado} erro={erroVisivel('nome')} valido={tocados.nome && !erros.nome} />
            <Campo id="r-telefone" rotulo="Celular com DDD" name="telefone" type="tel" inputMode="numeric" autoComplete="tel-national" placeholder="(11) 91234-5678" maxLength={16} value={dados.telefone} onChange={alterar} onBlur={marcarTocado} erro={erroVisivel('telefone')} valido={tocados.telefone && !erros.telefone} />
            <Campo id="r-email" rotulo="E-mail" name="email" type="email" inputMode="email" autoComplete="email" maxLength={254} value={dados.email} onChange={alterar} onBlur={marcarTocado} erro={erroVisivel('email')} valido={tocados.email && !erros.email} dica="O código da reserva e o link de cancelamento chegam aqui." largo />
            <div className="lgpd campo--largo">
              <IconePatinha />
              <p>{CONFIG.textos.privacidadeCurta} <a href="/privacidade" target="_blank" rel="noopener">Aviso de privacidade</a>.</p>
            </div>
            <Aceite name="aceite" checked={dados.aceite} onChange={alterar} erro={erroVisivel('aceite')}>
              Autorizo o uso do meu nome e contato para esta reserva.
            </Aceite>

            <div className="resumo campo--largo">
              <p className="resumo__linha"><strong>{resumo}</strong></p>
              <p className="resumo__linha">Total no local: <strong>{reais(total)}</strong> · pagamento no balcão</p>
              <button type="button" className="link" onClick={() => irPara(3)}>Alterar detalhes</button>
            </div>

            <div className="etapa__acoes campo--largo">
              <button type="button" className="botao botao--secundario" onClick={() => irPara(3)}>Voltar</button>
              <button className="botao botao--grande" type="submit" disabled={enviando} aria-busy={enviando || undefined}>
                {enviando ? 'Reservando…' : 'Confirmar reserva'}
              </button>
            </div>
          </form>
        </section>
      )}

      {etapa === 5 && confirmada && (
        <Confirmacao refTitulo={refTitulo(5)} {...confirmada} onNova={novaReserva} />
      )}
    </div>
  );
}

function Progresso({ etapa, onIr }) {
  return (
    <ol className="progresso" aria-label="Etapas da reserva">
      {ETAPAS.map((nome, i) => {
        const n = i + 1;
        const estado = n < etapa ? 'feito' : n === etapa ? 'atual' : 'pendente';
        return (
          <li key={nome} className={`progresso__passo progresso__passo--${estado}`} aria-current={estado === 'atual' ? 'step' : undefined}>
            {estado === 'feito' ? (
              <button type="button" onClick={() => onIr(n)} aria-label={`Voltar para a etapa ${n}: ${nome}`}>
                <span className="progresso__n">✓</span><span className="progresso__nome">{nome}</span>
              </button>
            ) : (
              <span><span className="progresso__n">{n}</span><span className="progresso__nome">{nome}</span></span>
            )}
          </li>
        );
      })}
    </ol>
  );
}

/** Calendário dos próximos 14 dias, alinhado por dia da semana. Dias fechados ficam desabilitados. */
function Calendario({ selecionado, onEscolher }) {
  const dias = useMemo(proximosDias, []);
  const vazios = diaDaSemana(dias[0]);
  const meses = [...new Set(dias.map((d) => rotuloDia(d).mes))].join(' / ');

  return (
    <div className="calendario">
      <p className="calendario__mes">{meses}</p>
      <div className="calendario__grade" role="group" aria-label="Escolha o dia">
        {SEMANA.map(([letra, nome]) => (
          <abbr key={nome} title={nome} className="calendario__semana">{letra}</abbr>
        ))}
        {Array.from({ length: vazios }, (_, i) => <span key={`v${i}`} aria-hidden="true" />)}
        {dias.map((iso, i) => {
          const r = rotuloDia(iso);
          const fechado = !gatil.diasAbertos.includes(diaDaSemana(iso));
          return (
            <button
              key={iso}
              type="button"
              className="calendario__dia"
              disabled={fechado}
              aria-pressed={iso === selecionado}
              aria-label={`${r.longo}${i === 0 ? ', hoje' : ''}${fechado ? ', fechado' : ''}`}
              onClick={() => onEscolher(iso)}
            >
              <span className="calendario__num">{r.numero}</span>
              {i === 0 && <span className="calendario__marca">hoje</span>}
            </button>
          );
        })}
      </div>
      <p className="nota">Dias riscados: gatil fechado. Dá pra reservar até {gatil.antecedenciaMaxDias} dias antes.</p>
    </div>
  );
}

function Horarios({ grade, hora, onEscolher, onOutroDia }) {
  if (grade.estado === 'carregando' || grade.estado === 'ocioso') {
    return <div className="horarios" aria-busy="true">{Array.from({ length: 12 }, (_, i) => <div key={i} className="esqueleto" />)}</div>;
  }
  let vazio = null;
  if (grade.estado === 'erro') vazio = grade.mensagem;
  else if (!grade.aberto) vazio = 'O gatil não abre nesse dia. Os gatos tão de folga 😴';
  else if (grade.horarios.length === 0) vazio = 'Os horários de hoje já passaram. Bora pra outro dia?';
  else if (grade.horarios.every((h) => h.vagas_15min === 0)) vazio = 'Esse dia lotou! Escolhe outro?';
  if (vazio) {
    return (
      <div className="vazio">
        <p>{vazio}</p>
        <button type="button" className="botao" onClick={onOutroDia}>Escolher outro dia</button>
      </div>
    );
  }
  return (
    <>
      <div className="horarios-grupos">
        {agruparPorJanela(grade.horarios).map((g) => (
          <div
            key={g.horarios[0].hora_inicio}
            className="horarios-grupo"
            role="group"
            aria-label={g.rotulo ? `Horários disponíveis, ${g.rotulo}` : 'Horários disponíveis'}
          >
            {g.rotulo && <p className="horarios-grupo__titulo" aria-hidden="true">{g.rotulo}</p>}
            <div className="horarios">
              {g.horarios.map((h) => {
                const vagas = h.vagas_15min;
                const texto = vagas === 0 ? 'esgotado' : vagas === 1 ? 'última vaga!' : `${vagas} vagas`;
                return (
                  <button
                    key={h.hora_inicio}
                    type="button"
                    className={`horario${vagas > 0 && vagas <= 2 ? ' horario--poucas' : ''}`}
                    disabled={vagas === 0}
                    aria-pressed={h.hora_inicio === hora}
                    aria-label={`${h.hora_inicio}, ${texto}`}
                    onClick={() => onEscolher(h.hora_inicio)}
                  >
                    <span className="horario__hora">{h.hora_inicio}</span>
                    <span className="horario__vagas">{texto}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      <p className="nota">Vagas para sessões a partir desse horário. Cada sessão termina dentro do horário da área dos gatos.</p>
    </>
  );
}

/**
 * Separa a grade em blocos contínuos, um por janela da área dos gatos, para a pausa ficar
 * visível (ex.: 10h30 às 11h50 e 13h10 às 17h30). O rótulo vem de CONFIG.gatil.janelas.
 */
function agruparPorJanela(horarios) {
  const grupos = [];
  for (const h of horarios) {
    const minutos = paraMinutos(h.hora_inicio);
    const atual = grupos.at(-1);
    if (atual && minutos - atual.ultimo === 15) {
      atual.horarios.push(h);
      atual.ultimo = minutos;
    } else {
      const janela = CONFIG.gatil.janelas.find((j) => minutos >= paraMinutos(j.abre) && minutos < paraMinutos(j.fecha));
      grupos.push({ horarios: [h], ultimo: minutos, rotulo: janela?.texto ?? null });
    }
  }
  return grupos;
}

function Confirmacao({ refTitulo, codigo, resumo, total, onNova }) {
  const [copiado, setCopiado] = useState(null);
  async function copiar() {
    try {
      await navigator.clipboard.writeText(codigo);
      setCopiado('Copiado!');
    } catch {
      setCopiado('Selecione e copie o código');
    }
  }
  return (
    <section className="confirmacao" aria-labelledby="etapa-5">
      <LogoGato tamanho={80} className="confirmacao__logo" />
      <h3 id="etapa-5" ref={refTitulo} tabIndex={-1}>{CONFIG.textos.confirmacao.titulo}</h3>
      <p>Seu código de reserva:</p>
      <p className="confirmacao__codigo">{codigo}</p>
      <p className="confirmacao__resumo">{resumo}<br />Total no local: <strong>{reais(total)}</strong></p>
      <p className="confirmacao__aviso">{CONFIG.textos.confirmacao.cancelamento(gatil.cancelamentoAteHorasAntes)}</p>
      <div className="etapa__acoes etapa__acoes--centro">
        <button className="botao botao--secundario" type="button" onClick={copiar}>{copiado ?? 'Copiar código'}</button>
        <a className="botao botao--secundario" href="#adocao">Conhecer os gatos</a>
        <button className="botao" type="button" onClick={onNova}>Fazer outra reserva</button>
      </div>
    </section>
  );
}
