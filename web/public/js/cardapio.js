import { api } from './api.js';
import { CARDAPIO_EXEMPLO } from './dados-exemplo.js';
import { $, el, reais } from './dom.js';

export async function iniciarCardapio(raiz) {
  const lista = $('[data-lista-cardapio]', raiz);
  const filtros = $('[data-filtros-cardapio]', raiz);
  const nota = $('[data-nota-cardapio]', raiz);
  lista.replaceChildren(...Array.from({ length: 4 }, () => el('li', { class: 'esqueleto' })));

  let itens;
  try {
    ({ itens } = await api.cardapio());
  } catch {
    itens = CARDAPIO_EXEMPLO;
    nota.textContent = 'Prévia do cardápio com itens ilustrativos. Preços e sabores podem mudar.';
    nota.hidden = false;
  }

  const categorias = ['Todos', ...new Set(itens.map((i) => i.categoria))];
  let ativa = 'Todos';

  function render() {
    for (const chip of filtros.children) chip.setAttribute('aria-pressed', String(chip.dataset.categoria === ativa));
    const visiveis = ativa === 'Todos' ? itens : itens.filter((i) => i.categoria === ativa);
    lista.replaceChildren(
      ...visiveis.map((i) =>
        el(
          'li',
          { class: 'item' },
          el('span', { class: 'item__nome' }, i.nome),
          el('span', { class: 'item__preco' }, reais(i.preco_centavos)),
          i.descricao ? el('p', { class: 'item__desc' }, i.descricao) : null,
        ),
      ),
    );
  }

  filtros.replaceChildren(
    ...categorias.map((c) =>
      el('button', { type: 'button', class: 'chip', dataset: { categoria: c }, onclick: () => { ativa = c; render(); } }, c),
    ),
  );
  render();
}
