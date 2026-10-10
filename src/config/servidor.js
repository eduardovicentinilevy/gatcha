/**
 * O que a API precisa a mais em produção, conferido no boot do SERVIDOR (src/server.js).
 * Fica fora do schema compartilhado de propósito: os jobs (migrações, expurgo LGPD) usam a
 * mesma config e não precisam de proxy nem de chave, então não podem quebrar por causa disso.
 *
 * @param {typeof import('./env.js').config} config
 * @returns {string[]} problemas (vazio = pode subir)
 */
export function problemasDoServidor(config) {
  if (!config.isProducao) return [];
  const problemas = [];
  if (!config.http.trustProxyDefinido) {
    problemas.push('TRUST_PROXY: obrigatório em produção: 1 com o Cloud Run direto, 2 com o Firebase Hosting na frente (README, "Atenção em produção")');
  } else if (config.http.trustProxy === 0) {
    problemas.push('TRUST_PROXY: 0 não serve no Cloud Run (sempre há ao menos um proxy na frente): use 1, ou 2 com o Firebase Hosting');
  }
  if (!config.dados.chave) {
    problemas.push('CHAVE_DADOS: obrigatória em produção (protege o 2FA e os IPs dos limites; README, "Deploy")');
  }
  return problemas;
}
