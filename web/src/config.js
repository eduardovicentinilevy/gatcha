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

/** "10:30" -> "10h30"; "10:00" -> "10h". */
const horaPorExtenso = (hhmm) => {
  const [h, m] = hhmm.split(':');
  return m === '00' ? `${Number(h)}h` : `${Number(h)}h${m}`;
};
const intervalo = (abre, fecha) => ({ abre, fecha, texto: `${horaPorExtenso(abre)} às ${horaPorExtenso(fecha)}` });

/**
 * Horários do Gatchá (perfil oficial: "Seg à Sáb · 10h às 18h30 · Área dos gatos 10h30 às 11h50 ~ 13h10 às 17h30").
 * Fonte única: o site inteiro (rodapé, "Visite", gatil, FAQ, selo "Aberto agora") lê daqui.
 * Devem bater com GATIL_DIAS e GATIL_JANELAS da API (.env.example). [CONFIRMAR na ligação com o Gatchá]
 */
const DIAS_ABERTOS = [1, 2, 3, 4, 5, 6]; // 0 = domingo ... 6 = sábado
const DIAS_TEXTO = 'Segunda a sábado';
const CAFE = intervalo('10:00', '18:30');
const JANELAS_GATOS = [intervalo('10:30', '11:50'), intervalo('13:10', '17:30')];

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
      botaoTexto: '#14180F', // texto sobre botões, selos e blocos coloridos
      escuroFixo: '#14180F', // blocos sempre escuros (hero, rodapé)
      claroFixo: '#FFF8EC',
      estrela: '#E8A400', // estrelas das avaliações
      fechado: '#E2725B', // bolinha do "Fechado agora"
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
      estrela: '#F2B417',
      fechado: '#F08A74',
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

  // Usado no selo "Aberto agora / Fechado agora" do rodapé (dias em CONFIG.gatil.diasAbertos).
  horarioCafe: { abre: CAFE.abre, fecha: CAFE.fecha },
  // O primeiro item é o destaque do rodapé. `horarios` pode ter mais de uma linha (a área dos gatos tem duas janelas).
  funcionamento: [
    { dias: DIAS_TEXTO, horarios: [CAFE.texto] },
    { dias: 'Área dos gatos', horarios: JANELAS_GATOS.map((j) => j.texto) },
    { dias: 'Domingo', horarios: ['Fechado (gatos de folga 😴)'] },
  ],

  // ---------------------------------------------------------------------------
  // Gatil e reserva
  // ---------------------------------------------------------------------------
  gatil: {
    fuso: 'America/Sao_Paulo',
    antecedenciaMaxDias: 14,
    /** 0 = domingo ... 6 = sábado. Deve bater com GATIL_DIAS da API. */
    diasAbertos: DIAS_ABERTOS,
    diasTexto: DIAS_TEXTO,
    /** Horários da área dos gatos. Devem bater com GATIL_JANELAS da API (que arredonda para dentro, de 15 em 15 min). */
    janelas: JANELAS_GATOS,
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

  /**
   * Avaliações reais do Google Maps (copiadas pelo dono do projeto), exibidas
   * quando a Places API não está configurada. Texto original; trechos longos
   * cortados com […]. Sobrenome abreviado por privacidade. `nota` só quando
   * conhecida (sem nota = sem estrelas, para não inventar).
   * [CONFIRMAR] autorização dos autores para uso no site (LGPD) antes de publicar.
   * O ideal em produção é a Places API (GOOGLE_PLACES_API_KEY), que segue as regras do Google.
   */
  avaliacoes: [
    {
      nome: 'Rafaela',
      fonte: 'Google Maps',
      texto:
        'Bem gostoso, fui com a minha namorada e ficamos 30 minutos com os gatinhos e foi muito incrível! Cada um tem uma personalidade bem diferente […] São varios gatinhos e queria levar todos eles mas não posso 🥲 fora os gatinhos, a bebida é bem gostosa […] O lugar é bem inclusivo, me senti muito acolhida',
    },
    {
      nome: 'Eduardo C.',
      fonte: 'Google Maps',
      texto:
        'A localização é maravilhosa, o ambiente é aconchegante, o atendimento é primoroso, o cardápio é bem estruturado com opção para público vegetariano ou até quem não quer sair da dieta! O matcha latte é sem açúcar (ponto positivo) e de qualidade superior, o pão de queijo com queijo da Canastra é uma delícia, para quem gosta de um docinho o cookie é delicioso. Pausa para falar do espaço dos gatinhos que é incrível, eu adorei a experiência! Amei o conceito de cat café 💚',
    },
    {
      nome: 'iPhotoworks',
      fonte: 'Google Maps',
      texto:
        'Um café padrão, com menu dominado por tudo relacionado a matcha. Para brincar com os gatos, é necessário fazer uma reserva, que pode ser feita dentro do próprio café. Os gatos também têm horário de descanso, então é importante prestar atenção no horário da visita caso você queira brincar com eles.',
    },
    {
      nome: 'Hannah C.',
      fonte: 'Google Maps',
      nota: 4,
      texto:
        'Coisas pra comer gostosas, gostei do matcha com yakult, o resto achei bem normal (não achei brownie e café particularmente o ponto alto). O valor é 15 reais por 15 minutos. Minha única nota que baixou para 4 seria o estabelecimento ser muuuiito pequeno e tava muito cheio, muito barulhento, os funcionarios pareciam estressados. Gatinhos eram fofos.',
    },
  ],

  /** Perguntas frequentes do painel de atendimento. [CONFIRMAR respostas com o cliente] */
  faq: [
    {
      pergunta: 'Qual o horário?',
      resposta: `Café: ${DIAS_TEXTO.toLowerCase()}, ${CAFE.texto}. Área dos gatos: ${JANELAS_GATOS.map((j) => j.texto).join(' e ')}. Domingo a gente descansa.`,
    },
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


  /**
   * LGPD — dados que aparecem no aviso de privacidade (/privacidade).
   * [CONFIRMAR] com o Gatchá: razão social, CNPJ, contato do encarregado e prazo dos interesses.
   * Os prazos de retenção devem ser iguais aos da API (RETENCAO_*_DIAS).
   */
  lgpd: {
    controlador: { razaoSocial: null, cnpj: null }, // [SUBSTITUIR] ex.: 'Gatchá Cat Café Ltda.', '00.000.000/0001-00'
    contatoTitular: null, // [SUBSTITUIR] e-mail para pedidos dos titulares, ex.: 'privacidade@gatcha.com.br'
    retencaoReservasDias: 90,
    retencaoInteressesDias: 180,
    atualizadoEm: '2026-10-05',
  },
});

/** Link do WhatsApp com mensagem pronta, ou null enquanto o número não for definido. */
export const linkWhatsapp = () =>
  CONFIG.contato.whatsapp
    ? `https://wa.me/${CONFIG.contato.whatsapp}?text=${encodeURIComponent(CONFIG.contato.mensagemWhatsapp)}`
    : null;

export const linkInstagram = () => `https://www.instagram.com/${CONFIG.contato.instagram}/`;
