/**
 * Configuração do site. Valores marcados como PROVISÓRIOS aguardam confirmação
 * do Gatchá. A API é a fonte da verdade para vagas e limites; aqui servem só
 * para exibição e validação amigável no navegador.
 */
export const CONFIG = Object.freeze({
  apiBase: import.meta.env.VITE_API_BASE || '/api',
  fuso: 'America/Sao_Paulo',
  antecedenciaMaxDias: 14,
  maxPessoasPorReserva: 4, // PROVISÓRIO — igual a RESERVA_MAX_PESSOAS da API
  // PROVISÓRIO — guias citam R$ 15 (15 min) e R$ 25 (30 min) por pessoa
  precosGatilCentavos: Object.freeze({ 15: 1500, 30: 2500 }),
  horarioFuncionamento: 'Terça a sábado, das 11h às 19h.', // PROVISÓRIO
  timeoutMs: 10_000,
});
