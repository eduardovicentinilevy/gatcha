/**
 * Confere, com o tráfego real, se TRUST_PROXY bate com os proxies na frente da API.
 *
 * Numa requisição que passou por todos os proxies, o X-Forwarded-For chega com
 * exatamente TRUST_PROXY endereços (Cloud Run direto = 1; Firebase -> Cloud Run = 2).
 * O visitante só consegue ACRESCENTAR endereços, nunca tirar. Olhando uma amostra
 * das primeiras requisições de cada instância (decide a maioria, para poucos
 * curiosos não enganarem o diagnóstico):
 *  - maioria com MENOS endereços = TRUST_PROXY alto: o IP pode ser forjado. ERRO.
 *  - maioria com MAIS endereços = TRUST_PROXY baixo: todos parecem o mesmo IP e o
 *    bloqueio de login trava a equipe. AVISO.
 *  - algumas com menos = alguém acessou a API direto (endereço *.run.app), sem passar
 *    pelo Firebase. AVISO (as proteções importantes não dependem do IP; docs/producao.md).
 * Requisições SEM o cabeçalho (sondas de saúde do Cloud Run, chamadas internas) não
 * passaram por proxy nenhum e ficam fora da conta. No log vão só contagens, nunca IPs.
 */
export function criarVerificadorDeProxy({ saltos, logger, amostra = 20 }) {
  const contagem = { menos: 0, iguais: 0, mais: 0 };
  let vistas = 0;
  let concluido = false;

  function relatar() {
    const campos = { trust_proxy: saltos, amostra: vistas, ...contagem };
    if (contagem.menos > vistas / 2) {
      logger.error('TRUST_PROXY parece ALTO para os proxies na frente da API: o IP do visitante pode ser forjado. Corrija TRUST_PROXY (docs/producao.md, "Atenção em produção").', campos);
    } else if (contagem.mais > vistas / 2) {
      logger.warn('TRUST_PROXY parece BAIXO: todos os visitantes podem aparecer com o mesmo IP (e o bloqueio de login travar a equipe). Corrija TRUST_PROXY (docs/producao.md, "Atenção em produção").', campos);
    } else if (contagem.menos > 0) {
      logger.warn('Algumas requisições chegaram sem passar por todos os proxies (acesso direto ao endereço *.run.app?). TRUST_PROXY parece certo.', campos);
    } else {
      logger.info('TRUST_PROXY confere com o tráfego.', campos);
    }
  }

  return function verificarProxy(req, _res, next) {
    if (!concluido) {
      const cabecalho = req.get('x-forwarded-for');
      if (cabecalho) {
        const recebidos = cabecalho.split(',').length;
        contagem[recebidos < saltos ? 'menos' : recebidos > saltos ? 'mais' : 'iguais']++;
        if (++vistas >= amostra) {
          concluido = true;
          relatar();
        }
      }
    }
    next();
  };
}
