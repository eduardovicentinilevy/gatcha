/**
 * Dados ILUSTRATIVOS para o protótipo navegável, usados só enquanto os
 * endpoints /api/cardapio e /api/gatos não existem. A página avisa o visitante
 * quando está exibindo estes dados. Remover quando o painel estiver no ar.
 */
export const CARDAPIO_EXEMPLO = [
  { id: 1, categoria: 'Matchá', nome: 'Matchá latte', descricao: 'Matchá batido na hora com leite vaporizado. Quente ou gelado.', preco_centavos: 2200 },
  { id: 2, categoria: 'Matchá', nome: 'Matchá cerimonial', descricao: 'Preparo tradicional com chasen, servido puro.', preco_centavos: 2400 },
  { id: 3, categoria: 'Matchá', nome: 'Matchá tônica', descricao: 'Água tônica, gelo e shot de matchá.', preco_centavos: 2300 },
  { id: 4, categoria: 'Cafés', nome: 'Espresso', descricao: 'Grãos especiais de torra média.', preco_centavos: 800 },
  { id: 5, categoria: 'Cafés', nome: 'Cappuccino', descricao: 'Espresso, leite vaporizado e espuma cremosa.', preco_centavos: 1400 },
  { id: 6, categoria: 'Doces', nome: 'Cookie de matchá', descricao: 'Com gotas de chocolate branco.', preco_centavos: 1200 },
  { id: 7, categoria: 'Doces', nome: 'Cheesecake de matchá', descricao: 'Fatia com base crocante.', preco_centavos: 1800 },
  { id: 8, categoria: 'Salgados', nome: 'Pão de queijo', descricao: 'Porção com 6 unidades.', preco_centavos: 1300 },
  { id: 9, categoria: 'Salgados', nome: 'Onigiri', descricao: 'Bolinho de arroz recheado. Consulte os sabores do dia.', preco_centavos: 1600 },
];

export const GATOS_EXEMPLO = [
  { id: 1, nome: 'Matcha', idade_meses: 8, sexo: 'femea', personalidade: 'Curiosa e brincalhona, adora caçar varinhas.', foto_url: null, status: 'disponivel' },
  { id: 2, nome: 'Mochi', idade_meses: 30, sexo: 'macho', personalidade: 'Calmo, ama um colo depois do almoço.', foto_url: null, status: 'disponivel' },
  { id: 3, nome: 'Sakura', idade_meses: 14, sexo: 'femea', personalidade: 'Tímida no começo, depois não sai do seu lado.', foto_url: null, status: 'em_processo' },
  { id: 4, nome: 'Tofu', idade_meses: 4, sexo: 'macho', personalidade: 'Filhote cheio de energia e muito falante.', foto_url: null, status: 'disponivel' },
];
