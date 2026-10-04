/**
 * Widget de reserva do gatil: dia -> duração/pessoas -> horário -> dados -> confirmação.
 * A API decide as vagas de verdade (transação no Postgres); aqui só exibimos
 * e, em caso de conflito (409), recarregamos a grade para mostrar o estado atual.
 */
import { CONFIG } from './config.js';
import { api, ErroApi } from './api.js';
import { $, $$, el, mostrarErrosDeCampo, reais } from './dom.js';

const fmtSemana = new Intl.DateTimeFormat('pt-BR', { weekday: 'short', timeZone: 'UTC' });
const fmtMes = new Intl.DateTimeFormat('pt-BR', { month: 'short', timeZone: 'UTC' });
const fmtLongo = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });
const semPonto = (s) => s.replace('.', '');
const dataUTC = (iso) => new Date(`${iso}T12:00:00Z`);

/** "Hoje" no fuso do café, independente do fuso do aparelho do cliente. */
function hojeNoCafe() {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', { timeZone: CONFIG.fuso, year: 'numeric', month: '2-digit', day: '2-digit' })
      .formatToParts(new Date())
      .map(({ type, value }) => [type, value]),
  );
  return `${p.year}-${p.month}-${p.day}`;
}

function proximosDias() {
  const base = dataUTC(hojeNoCafe());
  return Array.from({ length: CONFIG.antecedenciaMaxDias + 1 }, (_, i) => {
    const d = new Date(base);
    d.setUTCDate(d.getUTCDate() + i);
    return d.toISOString().slice(0, 10);
  });
}

/** Mesma normalização da API: só dígitos, sem o +55. */
function normalizarTelefone(valor) {
  const d = valor.replace(/\D/g, '');
  return d.length >= 12 && d.startsWith('55') ? d.slice(2) : d;
}

export function iniciarReserva(raiz) {
  const form = $('[data-form-reserva]', raiz);
  const ui = {
    dias: $('[data-dias]', raiz),
    horarios: $('[data-horarios]', raiz),
    notaHorarios: $('[data-nota-horarios]', raiz),
    pessoas: $('[data-pessoas]', raiz),
    pessoasRotulo: $('[data-pessoas-rotulo]', raiz),
    menos: $('[data-menos]', raiz),
    mais: $('[data-mais]', raiz),
    resumo: $('[data-resumo]', raiz),
    enviar: $('[data-enviar]', raiz),
    alerta: $('[data-alerta]', raiz),
    confirmacao: $('[data-confirmacao]', raiz),
    codigo: $('[data-codigo]', raiz),
    confirmacaoResumo: $('[data-confirmacao-resumo]', raiz),
  };

  const estado = { data: null, duracao: 15, pessoas: 1, hora: null, grade: null, carregando: false, enviando: false };
  let pedidoAtual = 0; // descarta respostas antigas se o usuário trocar de dia rápido

  // ---------------- Render ----------------
  function renderDias() {
    ui.dias.replaceChildren(
      ...proximosDias().map((iso) => {
        const d = dataUTC(iso);
        return el(
          'button',
          {
            type: 'button',
            class: 'dia',
            'aria-pressed': String(iso === estado.data),
            'aria-label': fmtLongo.format(d),
            onclick: () => selecionarDia(iso),
          },
          el('span', { class: 'dia__semana' }, semPonto(fmtSemana.format(d))),
          el('span', { class: 'dia__num' }, d.getUTCDate()),
          el('span', { class: 'dia__mes' }, semPonto(fmtMes.format(d))),
        );
      }),
    );
  }

  const vagasDe = (h) => (estado.duracao === 30 ? h.vagas_30min : h.vagas_15min);

  function renderHorarios() {
    ui.horarios.setAttribute('aria-busy', String(estado.carregando));
    if (estado.carregando && !estado.grade) {
      ui.horarios.replaceChildren(...Array.from({ length: 6 }, () => el('div', { class: 'esqueleto' })));
      ui.notaHorarios.textContent = '';
      return;
    }
    const grade = estado.grade;
    if (!grade) return;

    if (!grade.aberto) {
      ui.horarios.replaceChildren();
      ui.notaHorarios.textContent = 'O gatil não abre neste dia. Escolha outra data.';
      return;
    }
    if (grade.horarios.length === 0) {
      ui.horarios.replaceChildren();
      ui.notaHorarios.textContent = 'Não há mais horários hoje. Que tal outro dia?';
      return;
    }

    // Se o horário escolhido deixou de comportar o grupo, desmarca.
    const escolhido = grade.horarios.find((h) => h.hora_inicio === estado.hora);
    if (!escolhido || vagasDe(escolhido) < estado.pessoas) estado.hora = null;

    ui.horarios.replaceChildren(
      ...grade.horarios.map((h) => {
        const vagas = vagasDe(h);
        const cabe = vagas >= estado.pessoas;
        const textoVagas = vagas === 0 ? 'indisponível' : vagas === 1 ? '1 vaga' : `${vagas} vagas`;
        return el(
          'button',
          {
            type: 'button',
            class: 'horario',
            disabled: !cabe,
            'aria-pressed': String(h.hora_inicio === estado.hora),
            'aria-label': `${h.hora_inicio}, ${textoVagas}`,
            onclick: () => {
              estado.hora = h.hora_inicio;
              renderHorarios();
              renderResumo();
            },
          },
          el('span', { class: 'horario__hora' }, h.hora_inicio),
          el('span', { class: 'horario__vagas' }, textoVagas),
        );
      }),
    );
    const algumCabe = grade.horarios.some((h) => vagasDe(h) >= estado.pessoas);
    ui.notaHorarios.textContent = algumCabe
      ? `Vagas para sessões de ${estado.duracao} minutos.`
      : 'Nenhum horário comporta esse grupo neste dia. Tente menos pessoas, outra duração ou outra data.';
  }

  function renderPessoas() {
    ui.pessoas.value = String(estado.pessoas);
    ui.pessoas.textContent = String(estado.pessoas);
    ui.pessoasRotulo.textContent = estado.pessoas === 1 ? 'pessoa' : 'pessoas';
    ui.menos.disabled = estado.pessoas <= 1;
    ui.mais.disabled = estado.pessoas >= CONFIG.maxPessoasPorReserva;
  }

  function textoResumo() {
    const total = CONFIG.precosGatilCentavos[estado.duracao] * estado.pessoas;
    const quem = estado.pessoas === 1 ? '1 pessoa' : `${estado.pessoas} pessoas`;
    return `${fmtLongo.format(dataUTC(estado.data))}, às ${estado.hora} · ${estado.duracao} min · ${quem} · ${reais(total)} no local`;
  }

  function renderResumo() {
    ui.resumo.textContent = estado.data && estado.hora ? textoResumo() : 'Escolha dia e horário para ver o resumo.';
  }

  function alerta(mensagem) {
    ui.alerta.textContent = mensagem ?? '';
    ui.alerta.hidden = !mensagem;
  }

  // ---------------- Ações ----------------
  async function carregarGrade(iso) {
    const meu = ++pedidoAtual;
    estado.carregando = true;
    renderHorarios();
    try {
      const grade = await api.horarios(iso);
      if (meu !== pedidoAtual) return null;
      estado.grade = grade;
      return grade;
    } catch (erro) {
      if (meu !== pedidoAtual) return null;
      estado.grade = null;
      ui.horarios.replaceChildren();
      ui.notaHorarios.textContent = erro instanceof ErroApi ? erro.message : 'Não foi possível carregar os horários.';
      return null;
    } finally {
      if (meu === pedidoAtual) {
        estado.carregando = false;
        renderHorarios();
      }
    }
  }

  async function selecionarDia(iso) {
    if (estado.data === iso) return;
    estado.data = iso;
    estado.hora = null;
    estado.grade = null;
    alerta(null);
    renderDias();
    renderResumo();
    await carregarGrade(iso);
  }

  /** Na abertura, pula automaticamente para o primeiro dia com horário livre. */
  async function selecionarPrimeiroDiaDisponivel() {
    for (const iso of proximosDias()) {
      estado.data = iso;
      renderDias();
      const grade = await carregarGrade(iso);
      if (!grade) return; // erro de rede: mensagem já exibida
      if (grade.aberto && grade.horarios.some((h) => h.vagas_15min > 0)) return;
    }
  }

  function validarLocalmente(dados) {
    const erros = {};
    if (dados.nome.length < 2) erros.nome = 'Informe seu nome.';
    else if (!/^\p{L}[\p{L}\p{M}' .-]*$/u.test(dados.nome)) erros.nome = 'Use apenas letras, espaços, apóstrofo, ponto e hífen.';
    if (!/^[1-9]{2}\d{8,9}$/.test(normalizarTelefone(dados.telefone))) erros.telefone = 'Informe o celular com DDD.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(dados.email)) erros.email = 'Informe um e-mail válido.';
    if (!form.elements.aceite.checked) erros.aceite = 'É preciso concordar com o aviso de privacidade.';
    return erros;
  }

  async function enviar(evento) {
    evento.preventDefault();
    if (estado.enviando) return; // evita reserva duplicada por duplo clique
    alerta(null);

    if (!estado.data || !estado.hora) {
      alerta('Escolha o dia e o horário da visita.');
      ui.horarios.scrollIntoView({ block: 'center' });
      return;
    }
    const dados = {
      nome: form.elements.nome.value.trim().replace(/\s+/g, ' '),
      telefone: form.elements.telefone.value.trim(),
      email: form.elements.email.value.trim().toLowerCase(),
    };
    if (!mostrarErrosDeCampo(form, validarLocalmente(dados))) return;

    estado.enviando = true;
    ui.enviar.disabled = true;
    ui.enviar.setAttribute('aria-busy', 'true');
    ui.enviar.textContent = 'Reservando…';
    try {
      const { reserva } = await api.criarReserva({
        data: estado.data,
        hora_inicio: estado.hora,
        duracao_min: estado.duracao,
        pessoas: estado.pessoas,
        ...dados,
      });
      mostrarConfirmacao(reserva);
    } catch (erro) {
      tratarErroDeEnvio(erro);
    } finally {
      estado.enviando = false;
      ui.enviar.disabled = false;
      ui.enviar.removeAttribute('aria-busy');
      ui.enviar.textContent = 'Confirmar reserva';
    }
  }

  function tratarErroDeEnvio(erro) {
    if (!(erro instanceof ErroApi)) {
      alerta('Não foi possível concluir a reserva. Tente novamente.');
      return;
    }
    if (erro.codigo === 'DADOS_INVALIDOS') {
      const campos = erro.errosDeCampo;
      const dosDados = Object.fromEntries(Object.entries(campos).filter(([k]) => ['nome', 'telefone', 'email'].includes(k)));
      mostrarErrosDeCampo(form, dosDados);
      if (Object.keys(dosDados).length === 0) alerta(Object.values(campos)[0] ?? erro.message);
      return;
    }
    alerta(erro.message);
    // Vaga acabou, horário bloqueado ou já passou: mostra a grade atualizada.
    if (erro.status === 409 || (erro.status === 400 && erro.codigo.startsWith('HORARIO'))) {
      carregarGrade(estado.data);
    }
  }

  function mostrarConfirmacao(reserva) {
    ui.codigo.textContent = reserva.codigo;
    ui.confirmacaoResumo.textContent = textoResumo();
    form.hidden = true;
    ui.confirmacao.hidden = false;
    ui.confirmacao.focus();
    ui.confirmacao.scrollIntoView({ block: 'center' });
  }

  function novaReserva() {
    form.reset();
    mostrarErrosDeCampo(form, {});
    Object.assign(estado, { hora: null, pessoas: 1, duracao: 15 });
    renderPessoas();
    ui.confirmacao.hidden = true;
    form.hidden = false;
    renderResumo();
    carregarGrade(estado.data);
  }

  // ---------------- Eventos ----------------
  for (const radio of $$('input[name="duracao_min"]', form)) {
    radio.addEventListener('change', () => {
      estado.duracao = Number(radio.value);
      renderHorarios();
      renderResumo();
    });
  }
  ui.menos.addEventListener('click', () => {
    estado.pessoas = Math.max(1, estado.pessoas - 1);
    renderPessoas();
    renderHorarios();
    renderResumo();
  });
  ui.mais.addEventListener('click', () => {
    estado.pessoas = Math.min(CONFIG.maxPessoasPorReserva, estado.pessoas + 1);
    renderPessoas();
    renderHorarios();
    renderResumo();
  });
  form.addEventListener('submit', enviar);
  $('[data-nova]', raiz).addEventListener('click', novaReserva);
  $('[data-copiar]', raiz).addEventListener('click', async (e) => {
    try {
      await navigator.clipboard.writeText(ui.codigo.textContent);
      e.currentTarget.textContent = 'Copiado!';
    } catch {
      e.currentTarget.textContent = 'Selecione e copie o código';
    }
  });

  renderPessoas();
  renderDias();
  selecionarPrimeiroDiaDisponivel();
}

/** Cartões de preço do gatil. */
export function renderPrecos(alvo) {
  alvo.replaceChildren(
    ...Object.entries(CONFIG.precosGatilCentavos).map(([minutos, centavos]) =>
      el(
        'div',
        { class: 'preco' },
        el('p', { class: 'preco__tempo' }, `${minutos} minutos`),
        el('p', { class: 'preco__valor' }, reais(centavos)),
        el('p', { class: 'preco__por' }, 'por pessoa, pago no local'),
      ),
    ),
  );
}
