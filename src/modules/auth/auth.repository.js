/** SQL de usuários do painel e do log de acessos. Tudo parametrizado. */

export async function buscarUsuarioPorEmail(executor, email) {
  const { rows } = await executor.query('SELECT id, email, senha_hash FROM usuarios_admin WHERE email = $1', [email]);
  return rows[0] ?? null;
}

export async function buscarUsuarioPorId(executor, id) {
  const { rows } = await executor.query('SELECT id, email FROM usuarios_admin WHERE id = $1', [id]);
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
  const { rowCount } = await executor.query('UPDATE usuarios_admin SET senha_hash = $2 WHERE email = $1', [email, senhaHash]);
  return rowCount > 0;
}

/** Serializa tentativas de login do MESMO e-mail (sem isso, 100 tentativas simultâneas furariam o limite). */
export async function travarLogin(client, email) {
  await client.query('SELECT pg_advisory_xact_lock(7303, hashtext($1::text))', [email]);
}

/** Falhas de login deste e-mail na janela, desde o último login bem-sucedido. */
export async function contarFalhasRecentes(executor, email, janelaMinutos) {
  const { rows } = await executor.query(
    `SELECT count(*)::int AS total
       FROM acessos_admin
      WHERE email = $1
        AND evento = 'login_falha'
        AND criado_em > greatest(
              now() - make_interval(mins => $2::int),
              coalesce((SELECT max(criado_em) FROM acessos_admin WHERE email = $1 AND evento = 'login_ok'), '-infinity'::timestamptz)
            )`,
    [email, janelaMinutos],
  );
  return rows[0].total;
}

export async function registrarAcesso(executor, { usuarioId = null, email, evento, metodo = null, rota = null, status = null, ip = null }) {
  await executor.query(
    `INSERT INTO acessos_admin (usuario_id, email, evento, metodo, rota, status, ip)
     VALUES ($1, left($2, 254), $3, $4, left($5, 200), $6, left($7, 45))`,
    [usuarioId, email, evento, metodo, rota, status, ip],
  );
}
