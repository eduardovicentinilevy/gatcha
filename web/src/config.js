/**
 * =============================================================================
 *  CONFIGURAÇÃO CENTRAL DO SITE GATCHÁ
 *  Cores, textos, preços, horários e contatos ficam TODOS aqui.
 *  Procure por [SUBSTITUIR] (conteúdo real pendente) e [CONFIRMAR] (depende do cliente).
 * =============================================================================
 */

/** Modo protótipo: dados vêm dos JSON em /public/dados-exemplo e nenhuma reserva é real.
 *  Ativado com `npm run prototipo` (arquivo web/.env.prototipo). */
const MODO_PROTOTIPO = import.meta.env.VITE_MODO_PROTOTIPO === 'true';

export const CONFIG = Object.freeze({
  modoPrototipo: MODO_PROTOTIPO,

  // ---------------------------------------------------------------------------
  // Dados / API
  // ---------------------------------------------------------------------------
  apiBase: import.meta.env.VITE_API_BASE || '/api',
  // Base dos JSON de exemplo (mesmo formato da API). Para usar a API real, basta desligar o modo protótipo.
  dadosExemploBase: `${import.meta.env.BASE_URL}dados-exemplo`,
  timeoutMs: 10_000,

  // ---------------------------------------------------------------------------
  // Marca
  // ---------------------------------------------------------------------------
  marca: {
    nome: 'Gatchá',
    slogan: 'Cat café de matchá na República',
    fundacao: 'junho de 2022',
  },

  /**
   * Paleta. [SUBSTITUIR pelas cores oficiais da marca]
   * Aplicada como variáveis CSS em runtime (src/tema.js). Contraste AA conferido
   * para texto/fundo e para o botão principal (texto escuro sobre o verde).
   */
  cores: {
    claro: {
      fundo: '#FFF8EC', // creme
      superficie: '#FFFFFF',
      superficie2: '#F4EBD9',
      texto: '#14180F',
      textoSuave: '#4A5243',
      borda: '#14180F',
      sombra: '#14180F',
      matcha: '#6BA305', // verde do avatar
      matchaForte: '#3B6500', // links e textos em verde sobre claro
      matchaSuave: '#DDEFBF',
      destaque: '#FFD166', // selos
      rosa: '#FFC9D6', // detalhes "patinha"
      erro: '#B42318',
      erroFundo: '#FDECEA',
      botaoTexto: '#14180F', // texto sobre o botão verde
      escuroFixo: '#14180F', // blocos sempre escuros (hero, rodapé)
      claroFixo: '#FFF8EC',
    },
    escuro: {
      fundo: '#10140D',
      superficie: '#192113',
      superficie2: '#232D1B',
      texto: '#F4F1E6',
      textoSuave: '#BAC2AE',
      borda: '#E7EFD6',
      sombra: '#6BA305',
      matcha: '#7DBA14',
      matchaForte: '#AEDB63',
      matchaSuave: '#2C3A1C',
      destaque: '#FFD166',
      rosa: '#F3A9BC',
      erro: '#FF8A80',
      erroFundo: '#3A1714',
      botaoTexto: '#10140D',
      escuroFixo: '#0A0D08',
      claroFixo: '#FFF8EC',
    },
  },

  // ---------------------------------------------------------------------------
  // Endereço e contatos
  // ---------------------------------------------------------------------------
  endereco: {
    linha1: 'Av. São Luís, 187 · Piso 02, Loja 02',
    linha2: 'Galeria Metrópole · República · São Paulo, SP',
    consultaMapa: 'Gatchá, Av. São Luís, 187, Galeria Metrópole, São Paulo',
    comoChegar: [
      'Metrô República (linhas 3-Vermelha e 4-Amarela): uns 3 minutinhos a pé.',
      'Metrô Anhangabaú (linha 3-Vermelha): uns 7 minutos a pé.',
      'Dentro da Galeria Metrópole, 2º piso. Siga o cheiro de matchá. 🍵',
    ],
  },
  contato: {
    instagram: 'gatchasp',
    whatsapp: null, // [SUBSTITUIR] só dígitos com DDI, ex.: '5511912345678'. null = botão "em breve".
    mensagemWhatsapp: 'Oi, Gatchá! Vim pelo site e queria tirar uma dúvida 🐾',
    email: null, // [SUBSTITUIR] e-mail de contato, ex.: 'oi@gatcha.com.br'
  },

  /** [CONFIRMAR dias e horários] — as fontes públicas divergem (seg–sáb ou ter–sáb). */
  // Usado no selo "Aberto agora / Fechado agora" do rodapé (dias em CONFIG.gatil.diasAbertos).
  horarioCafe: { abre: '11:00', fecha: '19:00' },
  funcionamento: [
    { dias: 'Terça a sábado', horario: '11h às 19h' },
    { dias: 'Domingo e segunda', horario: 'Fechado (gatos de folga 😴)' },
  ],

  // ---------------------------------------------------------------------------
  // Gatil e reserva
  // ---------------------------------------------------------------------------
  gatil: {
    fuso: 'America/Sao_Paulo',
    antecedenciaMaxDias: 14,
    /** [CONFIRMAR] 0 = domingo ... 6 = sábado. Deve bater com GATIL_DIAS da API. */
    diasAbertos: [2, 3, 4, 5, 6],
    /** [CONFIRMAR] Deve bater com RESERVA_MAX_PESSOAS da API. */
    maxPessoasPorReserva: 4,
    /** [CONFIRMAR] Guias citam R$ 15 (15 min) e R$ 25 (30 min), por pessoa. */
    precosCentavos: { 15: 1500, 30: 2500 },
    cancelamentoAteHorasAntes: 1,
    regras: [
      ['🧼', 'Mãos lavadas antes de entrar. Os gatos agradecem.'],
      ['😴', 'Gato dormindo não se acorda. Colo só se ele pedir.'],
      ['🚫', 'Nada de petiscos ou bebidas pros gatos (nem um golinho de matchá).'],
      ['👧', 'Menores de 12 anos sempre com um adulto responsável.'],
      ['📸', 'Foto pode, flash não.'],
    ],
  },

  // ---------------------------------------------------------------------------
  // Textos
  // ---------------------------------------------------------------------------
  textos: {
    hero: {
      selo: 'Galeria Metrópole · República · SP',
      titulo: 'Bora tomar um matchá com companhia peluda?',
      subtitulo: 'Reserve seu horário no gatil em menos de 1 minuto e conheça os gatos antes de chegar.',
    },
    cardapio: {
      titulo: 'Verde por dentro, fofo por fora',
      subtitulo: 'Matchá de verdade, café passado com carinho e umas comidinhas pra acompanhar.',
    },
    gatil: {
      titulo: 'Um tempinho com os gatos',
      subtitulo: 'O gatil é a casa deles: as vagas são limitadas pra todo mundo ficar de boa. Pagamento no local.',
    },
    adocao: {
      titulo: 'Eles tão procurando um lar',
      subtitulo:
        'Os gatos do gatil são do Abrigo São Gabriel, ONG parceira desde o primeiro dia. Todos castrados, vacinados e prontos pra te escolher.',
    },
    avaliacoes: { titulo: 'Quem foi, voltou' },
    instagram: { titulo: 'Siga a gente', subtitulo: 'Bastidores, gato novo no pedaço e matchá do dia.' },
    visite: { titulo: 'Vem pro 2º andar da Galeria Metrópole' },
    confirmacao: {
      titulo: 'Reserva feita! 🐾',
      cancelamento: (horas) =>
        `Mudou de planos? Dá pra cancelar pelo link do e-mail de confirmação até ${horas} hora antes.`,
    },
    privacidadeCurta: 'Só pedimos nome e contato pra confirmar sua reserva. Nada de spam, prometido.',
  },

  /** Carrossel do topo. O "gato do dia" e a "bebida destaque" vêm dos dados (gatos/cardápio). */
  destaqueAdocao: {
    titulo: 'Adotar muda duas vidas',
    texto: 'Se apaixonou por algum gato? A gente te conecta com o Abrigo São Gabriel.',
  },

  /** [SUBSTITUIR] por avaliações reais (Google/Instagram), com autorização dos autores. */
  avaliacoes: [
    { nome: 'Júlia, 19', texto: 'Melhor matchá latte de SP e ainda tomei com o Mochi dormindo no meu colo. Voltarei.', nota: 5 },
    { nome: 'Rafa, 24', texto: 'Reservei no metrô, cheguei e já tava tudo certo. O gatil é muito cheiroso e organizado.', nota: 5 },
    { nome: 'Dona Cida, mãe da Bia (11)', texto: 'Regras claras e equipe atenciosa com as crianças. Me senti segura.', nota: 5 },
  ],

  /** Perguntas frequentes do painel de atendimento. [CONFIRMAR respostas com o cliente] */
  faq: [
    {
      pergunta: 'Posso levar criança?',
      resposta: 'Pode sim! Menores de 12 anos entram com um adulto responsável, e todo mundo segue as regras do gatil.',
    },
    {
      pergunta: 'Como funciona a adoção?',
      resposta:
        'Clique em "Quero conhecer" no gato que te conquistou. A gente repassa seu contato pro Abrigo São Gabriel, que conduz a entrevista e a adoção responsável.',
    },
    {
      pergunta: 'Preciso reservar?',
      resposta:
        'Pro café, não. Pro gatil é bom reservar: as vagas por horário são limitadas. Sobrou vaga? Dá pra entrar na hora, direto no balcão.',
    },
    {
      pergunta: 'Posso cancelar?',
      resposta: 'Pode, pelo link do e-mail de confirmação, até 1 hora antes do horário.',
    },
    {
      pergunta: 'Tem opção vegana?',
      resposta: 'Tem! Os itens veganos têm um selinho no cardápio, e qualquer matchá pode ser feito com leite vegetal.',
    },
  ],

  /**
   * Grade "Siga a gente". [SUBSTITUIR por fotos reais do Instagram]
   * Cada item pode ser só o texto alternativo (mostra ilustração) ou
   * { foto: '/img/instagram/1.jpg', alt: 'descrição da foto' } (arquivo em web/public/img/instagram/).
   */
  feedInstagram: [
    'Matchá latte com desenho de patinha na espuma',
    'Gato laranja dormindo em cima de uma almofada verde',
    'Mesa do café com cookies de matchá',
    'Gata tricolor olhando pela janela da galeria',
    'Preparo do matchá com batedor de bambu',
    'Dois gatos brincando com uma varinha de penas',
  ],

});

/** Link do WhatsApp com mensagem pronta, ou null enquanto o número não for definido. */
export const linkWhatsapp = () =>
  CONFIG.contato.whatsapp
    ? `https://wa.me/${CONFIG.contato.whatsapp}?text=${encodeURIComponent(CONFIG.contato.mensagemWhatsapp)}`
    : null;

export const linkInstagram = () => `https://www.instagram.com/${CONFIG.contato.instagram}/`;
