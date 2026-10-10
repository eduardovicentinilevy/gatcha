/**
 * "Store" do express-rate-limit no Postgres: o mesmo limite vale para TODAS as
 * instâncias do Cloud Run (o MemoryStore conta por instância, então com N
 * instâncias o limite real seria N vezes maior).
 *
 * - A chave gravada é um HMAC do nome do limitador + IP (ou id do usuário): o IP
 *   não fica no banco, e o HMAC com a CHAVE_DADOS (fora do banco) impede reverter a
 *   chave testando os ~4 bilhões de IPv4.
 * - Cada janela é uma linha que expira sozinha; o expurgo diário apaga as vencidas.
 * - Banco fora do ar = erro (503), não "passa direto": é a mesma dependência do
 *   login e do formulário que estes limites protegem.
 */
import { createHmac } from 'node:crypto';
import { pool } from '../db/pool.js';
import { derivarChave } from '../lib/chaves.js';

const segredo = () => derivarChave('limites-de-taxa-v1');

// Uma a cada N contagens também apaga janelas vencidas: com muitos IPs diferentes (ou
// forjados), a tabela não cresce sem freio entre um expurgo diário e o próximo.
const LIMPEZA_A_CADA = 200;

export class LimitePostgres {
  localKeys = false; // a contagem é compartilhada entre instâncias

  /** @param {string} prefixo nome do limitador (separa as contagens de cada um) */
  constructor(prefixo, executor = pool) {
    this.prefix = prefixo;
    this.executor = executor;
    this.janelaMs = 60_000;
  }

  init(opcoes) {
    this.janelaMs = opcoes.windowMs;
  }

  chave(cliente) {
    return createHmac('sha256', segredo()).update(`${this.prefix}:${cliente}`).digest('base64url');
  }

  async get(cliente) {
    const { rows } = await this.executor.query('SELECT contagem, expira_em FROM limites_taxa WHERE chave = $1 AND expira_em > now()', [this.chave(cliente)]);
    return rows[0] ? { totalHits: rows[0].contagem, resetTime: rows[0].expira_em } : undefined;
  }

  /** Conta mais um acesso; se a janela anterior venceu, começa outra (uma instrução só: sem corrida). */
  async increment(cliente) {
    const { rows } = await this.executor.query(
      `INSERT INTO limites_taxa AS l (chave, contagem, expira_em)
       VALUES ($1, 1, now() + make_interval(secs => $2::float8 / 1000))
       ON CONFLICT (chave) DO UPDATE SET
         contagem  = CASE WHEN l.expira_em <= now() THEN 1 ELSE l.contagem + 1 END,
         expira_em = CASE WHEN l.expira_em <= now() THEN EXCLUDED.expira_em ELSE l.expira_em END
       RETURNING contagem, expira_em`,
      [this.chave(cliente), this.janelaMs],
    );
    if (Math.random() < 1 / LIMPEZA_A_CADA) apagarLimitesVencidos(this.executor).catch(() => {}); // melhor esforço
    return { totalHits: rows[0].contagem, resetTime: rows[0].expira_em };
  }

  async decrement(cliente) {
    await this.executor.query('UPDATE limites_taxa SET contagem = greatest(contagem - 1, 0) WHERE chave = $1 AND expira_em > now()', [this.chave(cliente)]);
  }

  async resetKey(cliente) {
    await this.executor.query('DELETE FROM limites_taxa WHERE chave = $1', [this.chave(cliente)]);
  }
}

/** Expurgo: apaga as janelas vencidas. */
export async function apagarLimitesVencidos(executor) {
  const { rowCount } = await executor.query('DELETE FROM limites_taxa WHERE expira_em < now()');
  return rowCount;
}
