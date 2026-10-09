/**
 * Regras de exibição do cardápio compartilhadas pelo site e pelo painel:
 * ordem das categorias, ilustração de quem ainda não tem foto e selos.
 */

/** Ordem em que as categorias aparecem; as que não estão aqui vão para o fim, em ordem alfabética. */
export const ORDEM_CATEGORIAS = ['Matchás', 'Cafés', 'Doces', 'Salgados', 'Bebidas'];

const posicao = (categoria) => {
  const i = ORDEM_CATEGORIAS.indexOf(categoria);
  return i === -1 ? ORDEM_CATEGORIAS.length : i;
};

/** Compara duas categorias pela ordem acima (desempate alfabético). */
export const compararCategorias = (a, b) => posicao(a) - posicao(b) || a.localeCompare(b, 'pt-BR');

/** Desenho e cor do placeholder de cada categoria (ver Foto.jsx). */
const ILUSTRACOES = {
  Matchás: { icone: 'tigela', tom: 'matcha' },
  Cafés: { icone: 'xicara', tom: 'creme' },
  Doces: { icone: 'doce', tom: 'rosa' },
  Salgados: { icone: 'onigiri', tom: 'amarelo' },
  Bebidas: { icone: 'copo', tom: 'matcha' },
};
export const ilustracaoDaCategoria = (categoria) => ILUSTRACOES[categoria] ?? { icone: 'patinha', tom: 'creme' };

/** Selos dos itens: texto e classe CSS. */
export const SELOS = {
  mais_pedido: ['Mais pedido', 'selo--destaque'],
  vegano: ['Vegano', 'selo--matcha'],
  novo: ['Novo', 'selo--rosa'],
};
