/**
 * Confere, com o tráfego real, se TRUST_PROXY bate com os proxies na frente da API.
 *
 * Numa requisição legítima, o X-Forwarded-For chega com exatamente TRUST_PROXY
 * endereços (um por proxy: Cloud Run direto = 1; Firebase Hosting -> Cloud Run = 2).
 * O visitante só consegue ACRESCENTAR endereços, nunca tirar. Então:
 *  - menos endereços que TRUST_PROXY = valor alto demais: o IP pode ser forjado
 *    (fura os limites por IP). Isso aparece já no tráfego normal: vira ERRO no log.
 *  - mais endereços = valor baixo demais (todos parecem o mesmo IP e o bloqueio de
 *    login trava a equipe) OU só alguém mandando o cabeçalho por conta própria: AVISO.
 * Cada situação é registrada UMA vez por instância, sem IPs (só as contagens).
 */
export function criarVerificadorDeProxy({ saltos, logger }) {
  let avisouAlto = false;
  let avisouBaixo = false;
  return function verificarProxy(req, _res, next) {
    if (saltos > 0 && !(avisouAlto && avisouBaixo)) {
      const cabecalho = req.get('x-forwarded-for');
      const recebidos = cabecalho ? cabecalho.split(',').length : 0;
      if (recebidos < saltos && !avisouAlto) {
        avisouAlto = true;
        logger.error('TRUST_PROXY maior que o número de proxies na frente da API: o IP do visitante pode ser forjado. Corrija TRUST_PROXY (README, "Atenção em produção").', {
          trust_proxy: saltos,
          enderecos_x_forwarded_for: recebidos,
        });
      } else if (recebidos > saltos && !avisouBaixo) {
        avisouBaixo = true;
        logger.warn('X-Forwarded-For com mais endereços que TRUST_PROXY. Se isso aparecer sempre (e todos os acessos do painel saírem com o mesmo IP), TRUST_PROXY está baixo demais.', {
          trust_proxy: saltos,
          enderecos_x_forwarded_for: recebidos,
        });
      }
    }
    next();
  };
}
