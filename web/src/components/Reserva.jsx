/**
 * Reserva do gatil: dia -> duração/pessoas -> horário -> dados -> confirmação.
 * A API decide as vagas de verdade (transação no Postgres); aqui só exibimos
 * e, em caso de conflito (409), recarregamos a grade para mostrar o estado atual.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CONFIG } from '../config.js';
import { api, ErroApi } from '../api.js';
import { focarPrimeiroErro, normalizarTelefone, proximosDias, reais, RE_NOME, rotuloDia } from '../util.js';
import Campo, { Aceite } from './Campo.jsx';
import LogoGato from './LogoGato.jsx';

const DADOS_VAZIOS = { nome: '', telefone: '', email: '', aceite: false };

export default function Reserva() {
  const dias = useMemo(proximosDias, []);
  const [data, setData] = useState(null);
  const [duracao, setDuracao] = useState(15);
  const [pessoas, setPessoas] = useState(1);
  const [hora, setHora] = useState(null);
  const [grade, setGrade] = useState({ estado: 'ocioso' }); // ocioso | carregando | pronto | erro
  const [versaoGrade, setVersaoGrade] = useState(0); // incrementar = recarregar
  const [dados, setDados] = useState(DADOS_VAZIOS);
  const [erros, setErros] = useState({});
  const [alerta, setAlerta] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const [confirmada, setConfirmada] = useState(null);
  const formRef = useRef(null);
  const confirmacaoRef = useRef(null);
  const horariosRef = useRef(null);

  // Na abertura, pula para o primeiro dia aberto e com horário livre.
  useEffect(() => {
    const controle = new AbortController();
    (async () => {
      for (const iso of dias) {
        try {
          const g = await api.horarios(iso, controle.signal);
          if (g.aberto && g.horarios.some((h) => h.vagas_15min > 0)) {
            setGrade({ estado: 'pronto', ...g });
            setData(iso);
            return;
          }
        } catch (erro) {
          if (controle.signal.aborted) return;
          setData(iso);
          setGrade({ estado: 'erro', mensagem: erro.message });
          return;
        }
      }
      setData(dias[0]);
    })();
    return () => controle.abort();
  }, [dias]);

  // Carrega a grade quando o usuário troca de dia ou pede recarga (versaoGrade).
  // O AbortController descarta respostas antigas se o usuário trocar de dia rápido.
  const primeiraCarga = useRef(true);
  useEffect(() => {
    if (!data) return undefined;
    if (primeiraCarga.current) {
      primeiraCarga.current = false; // a busca inicial acima já trouxe esta grade
      if (grade.estado !== 'ocioso') return undefined;
    }
    const controle = new AbortController();
    setGrade((g) => ({ ...g, estado: 'carregando' }));
    api
      .horarios(data, controle.signal)
      .then((g) => setGrade({ estado: 'pronto', ...g }))
      .catch((erro) => {
        if (!controle.signal.aborted) setGrade({ estado: 'erro', mensagem: erro.message });
      });
    return () => controle.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- grade.estado só importa na primeira carga
  }, [data, versaoGrade]);

  const vagasDe = useCallback((h) => (duracao === 30 ? h.vagas_30min : h.vagas_15min), [duracao]);
  const horarios = grade.horarios ?? [];

  // Se o horário escolhido deixou de comportar o grupo (ou sumiu da grade), desmarca.
  useEffect(() => {
    if (!hora) return;
    const h = horarios.find((x) => x.hora_inicio === hora);
    if (!h || vagasDe(h) < pessoas) setHora(null);
  }, [horarios, hora, pessoas, vagasDe]);

  const resumo = data && hora
    ? `${rotuloDia(data).longo}, às ${hora} · ${duracao} min · ${pessoas === 1 ? '1 pessoa' : `${pessoas} pessoas`} · ${reais(CONFIG.precosGatilCentavos[duracao] * pessoas)} no local`
    : null;

  function escolherDia(iso) {
    if (iso === data) return;
    setData(iso);
    setHora(null);
    setAlerta(null);
  }

  const alterar = (e) => {
    const { name, type, checked, value } = e.target;
    setDados((d) => ({ ...d, [name]: type === 'checkbox' ? checked : value }));
  };

  function validar(d) {
    const e = {};
    if (d.nome.length < 2) e.nome = 'Informe seu nome.';
    else if (!RE_NOME.test(d.nome)) e.nome = 'Use apenas letras, espaços, apóstrofo, ponto e hífen.';
    if (!/^[1-9]{2}\d{8,9}$/.test(normalizarTelefone(d.telefone))) e.telefone = 'Informe o celular com DDD.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email)) e.email = 'Informe um e-mail válido.';
    if (!d.aceite) e.aceite = 'É preciso concordar com o aviso de privacidade.';
    return e;
  }

  async function enviar(evento) {
    evento.preventDefault();
    if (enviando) return; // evita reserva duplicada por duplo clique
    setAlerta(null);

    if (!data || !hora) {
      setAlerta('Escolha o dia e o horário da visita.');
      horariosRef.current?.scrollIntoView({ block: 'center' });
      return;
    }
    const limpos = {
      nome: dados.nome.trim().replace(/\s+/g, ' '),
      telefone: dados.telefone.trim(),
      email: dados.email.trim().toLowerCase(),
    };
    const errosLocais = validar({ ...limpos, aceite: dados.aceite });
    setErros(errosLocais);
    if (Object.keys(errosLocais).length > 0) {
      focarPrimeiroErro(formRef.current, errosLocais);
      return;
    }

    setEnviando(true);
    try {
      const { reserva } = await api.criarReserva({ data, hora_inicio: hora, duracao_min: duracao, pessoas, ...limpos });
      setConfirmada({ codigo: reserva.codigo, resumo });
    } catch (erro) {
      tratarErro(erro);
    } finally {
      setEnviando(false);
    }
  }

  function tratarErro(erro) {
    if (!(erro instanceof ErroApi)) {
      setAlerta('Não foi possível concluir a reserva. Tente novamente.');
      return;
    }
    if (erro.codigo === 'DADOS_INVALIDOS') {
      const campos = erro.errosDeCampo;
      const dosDados = Object.fromEntries(Object.entries(campos).filter(([k]) => k in DADOS_VAZIOS));
      setErros(dosDados);
      if (Object.keys(dosDados).length > 0) focarPrimeiroErro(formRef.current, dosDados);
      else setAlerta(Object.values(campos)[0] ?? erro.message);
      return;
    }
    setAlerta(erro.message);
    // Vaga acabou, horário bloqueado ou já passou: mostra a grade atualizada.
    if (erro.status === 409 || (erro.status === 400 && erro.codigo.startsWith('HORARIO'))) setVersaoGrade((v) => v + 1);
  }

  useEffect(() => {
    if (confirmada) {
      confirmacaoRef.current?.focus();
      confirmacaoRef.current?.scrollIntoView({ block: 'center' });
    }
  }, [confirmada]);

  function novaReserva() {
    setConfirmada(null);
    setDados(DADOS_VAZIOS);
    setErros({});
    setHora(null);
    setPessoas(1);
    setDuracao(15);
    setVersaoGrade((v) => v + 1);
  }

  if (confirmada) return <Confirmacao ref={confirmacaoRef} {...confirmada} onNova={novaReserva} />;

  return (
    <div id="reserva" className="reserva">
      <form ref={formRef} className="reserva__form" noValidate onSubmit={enviar}>
        <fieldset className="passo">
          <legend><span className="passo__n">1</span> Escolha o dia</legend>
          <div className="dias" role="group" aria-label="Dia da visita">
            {dias.map((iso) => {
              const r = rotuloDia(iso);
              return (
                <button key={iso} type="button" className="dia" aria-pressed={iso === data} aria-label={r.longo} onClick={() => escolherDia(iso)}>
                  <span className="dia__semana">{r.semana}</span>
                  <span className="dia__num">{r.numero}</span>
                  <span className="dia__mes">{r.mes}</span>
                </button>
              );
            })}
          </div>
        </fieldset>

        <fieldset className="passo passo--linha">
          <legend><span className="passo__n">2</span> Duração e pessoas</legend>
          <div className="alternador" role="radiogroup" aria-label="Duração">
            {[15, 30].map((m) => (
              <label key={m}>
                <input type="radio" name="duracao_min" value={m} checked={duracao === m} onChange={() => setDuracao(m)} /> {m} min
              </label>
            ))}
          </div>
          <div className="contador">
            <button type="button" aria-label="Menos uma pessoa" disabled={pessoas <= 1} onClick={() => setPessoas((p) => p - 1)}>−</button>
            <output aria-live="polite">{pessoas}</output>
            <span className="contador__rotulo">{pessoas === 1 ? 'pessoa' : 'pessoas'}</span>
            <button type="button" aria-label="Mais uma pessoa" disabled={pessoas >= CONFIG.maxPessoasPorReserva} onClick={() => setPessoas((p) => p + 1)}>+</button>
          </div>
        </fieldset>

        <fieldset className="passo">
          <legend><span className="passo__n">3</span> Escolha o horário</legend>
          <GradeHorarios ref={horariosRef} grade={grade} vagasDe={vagasDe} pessoas={pessoas} duracao={duracao} hora={hora} onEscolher={setHora} />
        </fieldset>

        <fieldset className="passo">
          <legend><span className="passo__n">4</span> Seus dados</legend>
          <div className="campos">
            <Campo id="r-nome" rotulo="Nome" name="nome" autoComplete="name" required minLength={2} maxLength={100} value={dados.nome} onChange={alterar} erro={erros.nome} />
            <Campo id="r-telefone" rotulo="Celular com DDD" name="telefone" type="tel" inputMode="tel" autoComplete="tel" placeholder="(11) 91234-5678" required maxLength={20} value={dados.telefone} onChange={alterar} erro={erros.telefone} />
            <Campo id="r-email" rotulo="E-mail" name="email" type="email" inputMode="email" autoComplete="email" required maxLength={254} value={dados.email} onChange={alterar} erro={erros.email} largo />
            <Aceite name="aceite" checked={dados.aceite} onChange={alterar} erro={erros.aceite}>
              Li o <a href="/privacidade" target="_blank" rel="noopener">aviso de privacidade</a> e autorizo o uso do meu nome e contato para esta reserva.
            </Aceite>
          </div>
        </fieldset>

        <div className="reserva__resumo">
          <p>{resumo ?? 'Escolha dia e horário para ver o resumo.'}</p>
          <button className="botao botao--grande" type="submit" disabled={enviando} aria-busy={enviando || undefined}>
            {enviando ? 'Reservando…' : 'Confirmar reserva'}
          </button>
        </div>
        {alerta && <p className="alerta" role="alert">{alerta}</p>}
      </form>
    </div>
  );
}

function GradeHorarios({ ref, grade, vagasDe, pessoas, duracao, hora, onEscolher }) {
  const carregando = grade.estado === 'carregando' || grade.estado === 'ocioso';

  let nota = '';
  if (grade.estado === 'erro') nota = grade.mensagem;
  else if (grade.aberto === false) nota = 'O gatil não abre neste dia. Escolha outra data.';
  else if (grade.horarios?.length === 0) nota = 'Não há mais horários hoje. Que tal outro dia?';
  else if (grade.horarios && !grade.horarios.some((h) => vagasDe(h) >= pessoas))
    nota = 'Nenhum horário comporta esse grupo neste dia. Tente menos pessoas, outra duração ou outra data.';
  else if (grade.horarios) nota = `Vagas para sessões de ${duracao} minutos.`;

  return (
    <>
      <div ref={ref} className="horarios" role="group" aria-label="Horário" aria-busy={carregando}>
        {carregando && !grade.horarios
          ? [1, 2, 3, 4, 5, 6].map((n) => <div key={n} className="esqueleto" />)
          : grade.estado !== 'erro' && grade.aberto && grade.horarios.map((h) => {
              const vagas = vagasDe(h);
              const texto = vagas === 0 ? 'indisponível' : vagas === 1 ? '1 vaga' : `${vagas} vagas`;
              return (
                <button
                  key={h.hora_inicio}
                  type="button"
                  className="horario"
                  disabled={vagas < pessoas}
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
      <p className="nota">{nota}</p>
    </>
  );
}

function Confirmacao({ ref, codigo, resumo, onNova }) {
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
    <div id="reserva" className="reserva">
      <div ref={ref} className="confirmacao" tabIndex={-1}>
        <LogoGato tamanho={72} />
        <h3>Reserva confirmada!</h3>
        <p>Guarde o seu código e apresente na recepção do gatil.</p>
        <p className="confirmacao__codigo">{codigo}</p>
        <p>{resumo}</p>
        <div className="confirmacao__acoes">
          <button className="botao botao--contorno" type="button" onClick={copiar}>{copiado ?? 'Copiar código'}</button>
          <button className="botao" type="button" onClick={onNova}>Fazer outra reserva</button>
        </div>
      </div>
    </div>
  );
}
