import { api, ErroApi } from './api.js';
import { GATOS_EXEMPLO } from './dados-exemplo.js';
import { $, desenhoGato, el, mostrarErrosDeCampo } from './dom.js';

const CORES_AVATAR = ['#6BA305', '#4A7304', '#0D1117', '#8DB33A'];

function idade(meses) {
  if (meses == null) return null;
  if (meses < 12) return meses === 1 ? '1 mês' : `${meses} meses`;
  const anos = Math.floor(meses / 12);
  return anos === 1 ? '1 ano' : `${anos} anos`;
}

/** Só aceita fotos HTTPS (a API também valida); qualquer outra coisa vira avatar. */
function foto(gato, i) {
  if (typeof gato.foto_url === 'string' && gato.foto_url.startsWith('https://')) {
    return el('img', { class: 'gato__foto', src: gato.foto_url, alt: `Foto de ${gato.nome}`, loading: 'lazy', decoding: 'async', referrerpolicy: 'no-referrer' });
  }
  const avatar = el('div', { class: 'gato__avatar', role: 'img', 'aria-label': `Ilustração de ${gato.nome}` }, desenhoGato());
  avatar.style.background = CORES_AVATAR[i % CORES_AVATAR.length];
  return avatar;
}

export async function iniciarAdocao(raiz) {
  const lista = $('[data-lista-gatos]', raiz);
  const nota = $('[data-nota-gatos]', raiz);
  const dialogo = $('[data-dialogo-adocao]', raiz);
  const form = $('[data-form-interesse]', raiz);
  const alerta = $('[data-alerta]', form);
  lista.replaceChildren(...Array.from({ length: 3 }, () => el('li', { class: 'esqueleto' })));

  let gatos;
  try {
    ({ gatos } = await api.gatos());
  } catch {
    gatos = GATOS_EXEMPLO;
    nota.textContent = 'Prévia da galeria com gatos ilustrativos. Em breve, os gatos reais do Abrigo São Gabriel.';
    nota.hidden = false;
  }
  gatos = gatos.filter((g) => g.status !== 'adotado');

  if (gatos.length === 0) {
    lista.replaceChildren(el('li', { class: 'nota' }, 'Todos os gatos foram adotados! Volte em breve para conhecer os novos moradores.'));
    return;
  }

  lista.replaceChildren(
    ...gatos.map((g, i) =>
      el(
        'li',
        { class: 'gato' },
        foto(g, i),
        el(
          'div',
          { class: 'gato__corpo' },
          el('h3', {}, g.nome),
          el(
            'div',
            { class: 'gato__meta' },
            idade(g.idade_meses) ? el('span', { class: 'etiqueta' }, idade(g.idade_meses)) : null,
            el('span', { class: 'etiqueta' }, g.sexo === 'femea' ? 'Fêmea' : 'Macho'),
            g.status === 'em_processo' ? el('span', { class: 'etiqueta etiqueta--processo' }, 'Em processo de adoção') : null,
          ),
          g.personalidade ? el('p', {}, g.personalidade) : null,
          el('button', { type: 'button', class: 'botao botao--contorno', onclick: () => abrir(g) }, `Quero conhecer ${g.nome}`),
        ),
      ),
    ),
  );

  function abrir(gato) {
    form.reset();
    mostrarErrosDeCampo(form, {});
    alerta.hidden = true;
    alerta.className = 'alerta campo--largo';
    form.elements.gato_id.value = String(gato.id);
    $('[data-nome-gato]', dialogo).textContent = gato.nome;
    dialogo.showModal();
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const botao = form.querySelector('button[type="submit"]');
    if (botao.disabled) return;
    alerta.hidden = true;

    const dados = {
      gato_id: Number(form.elements.gato_id.value),
      nome: form.elements.nome.value.trim().replace(/\s+/g, ' '),
      contato: form.elements.contato.value.trim(),
      mensagem: form.elements.mensagem.value.trim() || undefined,
    };
    const erros = {};
    if (dados.nome.length < 2) erros.nome = 'Informe seu nome.';
    if (dados.contato.length < 8) erros.contato = 'Informe um e-mail ou celular.';
    if (!form.elements.aceite.checked) erros.aceite = 'É preciso autorizar o envio à ONG.';
    if (!mostrarErrosDeCampo(form, erros)) return;

    botao.disabled = true;
    try {
      await api.registrarInteresse(dados);
      alerta.textContent = 'Recebemos seu interesse! A equipe vai repassar à ONG, que entrará em contato.';
      alerta.classList.add('alerta--ok');
      form.reset();
    } catch (erro) {
      alerta.classList.remove('alerta--ok');
      if (erro instanceof ErroApi && erro.codigo === 'DADOS_INVALIDOS') mostrarErrosDeCampo(form, erro.errosDeCampo);
      alerta.textContent =
        erro instanceof ErroApi && erro.status === 404
          ? 'O formulário online ainda não está disponível. Fale com a equipe no café!'
          : erro.message;
    } finally {
      alerta.hidden = false;
      botao.disabled = false;
    }
  });
}
