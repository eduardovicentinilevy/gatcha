/** SQL de usuários do painel e do log de acessos. Tudo parametrizado. */

export async function buscarUsuarioPorEmail(executor, email) {
  const { rows } = await executor.query('SELECT id, email, senha_hash, totp_segredo, totp_ultimo_passo FROM usuarios_admin WHERE email = $1', [email]);
  return rows[0] ?? null;
}

export async function buscarUsuarioPorId(executor, id) {
  const { rows } = await executor.query('SELECT id, email, senha_alterada_em FROM usuarios_admin WHERE id = $1', [id]);
  return rows[0] ?? null;
}

export async function criarUsuario(executor, { email, senhaHash }) {
  const { rows } = await executor.query(
    'INSERT INTO usuarios_admin (email, senha_hash) VALUES ($1, $2) RETURNING id, email',
    [email, senhaHash],
  );
  return rows[0];
}

export async function atualizarSenha(executor, { email, senhaHash }) {
  const { rowCount } = await executor.query('UPDATE usuarios_admin SET senha_hash = $2, senha_alterada_em = now() WHERE email = $1', [email, senhaHash]);
  return rowCount > 0;
}

/** Serializa tentativas de login do MESMO e-mail (sem isso, 100 tentativas simultâneas furariam o limite). */
export async function travarLogin(client, email) {
  await client.query('SELECT pg_advisory_xact_lock(7303, hashtext($1::text))', [email]);
}

/**
 * Falhas REAIS (status 401, senha ou código do 2FA) deste e-mail na janela, desde o último login bem-sucedido:
 * `porIp` (deste e-mail vindo deste IP) e `global` (todos os IPs).
 * Tentativas bloqueadas (status 429) NÃO contam: senão quem insiste em tentar mantém
 * a conta travada para sempre (ataque de negação de serviço contra a equipe).
 */
export async function contarFalhasRecentes(executor, email, ip, janelaMinutos) {
  const { rows } = await executor.query(
    `SELECT count(*) FILTER (WHERE ip IS NOT DISTINCT FROM $2)::int AS por_ip,
            count(*)::int                                             AS global
       FROM acessos_admin
      WHERE email = $1
        AND evento IN ('login_falha', 'falha_2fa')
        AND status = 401
        AND criado_em > greatest(
              now() - make_interval(mins => $3::int),
              coalesce((SELECT max(criado_em) FROM acessos_admin WHERE email = $1 AND evento = 'login_ok'), '-infinity'::timestamptz)
            )`,
    [email, ip, janelaMinutos],
  );
  return { porIp: rows[0].por_ip, global: rows[0].global };
}

/**
 * Reserva a tentativa ANTES de conferir a senha, já contada como falha. Assim a
 * conferência (bcrypt, lenta) acontece fora da transação e sem segurar conexão do
 * pool, e tentativas simultâneas continuam sendo contadas uma a uma.
 */
export async function reservarTentativa(client, { usuarioId, email, ip }) {
  const { rows } = await client.query(
    `INSERT INTO acessos_admin (usuario_id, email, evento, rota, status, ip)
     VALUES ($1, left($2, 254), 'login_falha', '/api/auth/login', 401, left($3, 45)) RETURNING id`,
    [usuarioId, email, ip],
  );
  return rows[0].id;
}

/** Senha conferiu: a tentativa reservada vira um login bem-sucedido (zera as falhas). */
export async function confirmarLogin(executor, { id, usuarioId }) {
  await executor.query(
    "UPDATE acessos_admin SET evento = 'login_ok', status = 200, usuario_id = $2 WHERE id = $1",
    [id, usuarioId],
  );
}

export async function registrarAcesso(executor, { usuarioId = null, email, evento, metodo = null, rota = null, status = null, ip = null }) {
  await executor.query(
    `INSERT INTO acessos_admin (usuario_id, email, evento, metodo, rota, status, ip)
     VALUES ($1, left($2, 254), $3, $4, left($5, 200), $6, left($7, 45))`,
    [usuarioId, email, evento, metodo, rota, status, ip],
  );
}

// ---------------------------------------------------------------- 2FA (TOTP)

/** Ativa (segredo cifrado) ou desativa (null) o 2FA. Encerra as sessões abertas do usuário. */
export async function definirSegredo2fa(executor, { id, segredoCifrado, ultimoPasso = null }) {
  await executor.query(
    'UPDATE usuarios_admin SET totp_segredo = $2, totp_ultimo_passo = $3, senha_alterada_em = now() WHERE id = $1',
    [id, segredoCifrado, ultimoPasso],
  );
}

/** Grava o passo do código aceito; false se ele (ou um mais novo) já foi usado (corrida ou reuso). */
export async function registrarPasso2fa(executor, { id, passo }) {
  const { rowCount } = await executor.query(
    'UPDATE usuarios_admin SET totp_ultimo_passo = $2 WHERE id = $1 AND (totp_ultimo_passo IS NULL OR totp_ultimo_passo < $2)',
    [id, passo],
  );
  return rowCount > 0;
}

/** A tentativa reservada passa a contar como código do 2FA errado. */
export async function marcarFalha2fa(executor, { id }) {
  await executor.query("UPDATE acessos_admin SET evento = 'falha_2fa' WHERE id = $1", [id]);
}

/** Códigos errados nas últimas 24 h, desde o último login bem-sucedido ou a última troca de senha. */
export async function contarFalhas2fa(executor, { usuarioId }) {
  const { rows } = await executor.query(
    `SELECT count(*)::int AS falhas
       FROM acessos_admin a
      WHERE a.usuario_id = $1
        AND a.evento = 'falha_2fa'
        AND a.criado_em > greatest(
              now() - interval '24 hours',
              (SELECT senha_alterada_em FROM usuarios_admin WHERE id = $1),
              coalesce((SELECT max(criado_em) FROM acessos_admin WHERE usuario_id = $1 AND evento = 'login_ok'), '-infinity'::timestamptz)
            )`,
    [usuarioId],
  );
  return rows[0].falhas;
}
