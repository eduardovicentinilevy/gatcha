/**
 * Repository: ÚNICO lugar que conhece SQL de reservas/bloqueios.
 *
 * Toda função recebe um `executor` (o pool OU o client de uma transação), para
 * que o Service decida o escopo transacional (Unit of Work) sem o Repository
 * precisar saber disso.
 *
 * Segurança: 100% das consultas são estáticas e parametrizadas ($1, $2…). Nenhum
 * valor vindo do usuário é concatenado em SQL — prevenção de SQL Injection na raiz.
 */

// Namespaces fixos dos advisory locks (evitam colidir com outros locks do sistema).
const LOCK_NAMESPACE_AGENDA = 7301;
const LOCK_NAMESPACE_CONTATO = 7302;

/**
 * Serializa as escritas na agenda de UMA data: até o fim da transação, outras
 * transações que chamarem esta função para a mesma data ficam esperando.
 * Reservas de datas diferentes continuam em paralelo.
 * O lock é liberado automaticamente no COMMIT/ROLLBACK (xact), sem risco de vazar.
 */
export async function travarAgendaDoDia(client, data) {
  await client.query('SELECT pg_advisory_xact_lock($1::int, hashtext($2::text))', [LOCK_NAMESPACE_AGENDA, data]);
}

/**
 * Serializa as reservas de um mesmo CONTATO (e-mail e telefone), em qualquer
 * data: sem isso, dois pedidos simultâneos para dias diferentes pegariam locks
 * de datas diferentes e ambos passariam pelo limite de reservas ativas.
 * Ordem fixa (contato antes da data; chaves ordenadas) evita deadlock.
 */
export async function travarContato(client, { email, telefone }) {
  for (const chave of [`e:${email}`, `t:${telefone}`].sort()) {
    await client.query('SELECT pg_advisory_xact_lock($1::int, hashtext($2::text))', [LOCK_NAMESPACE_CONTATO, chave]);
  }
}

/**
 * Reservas ativas e bloqueios da data, já convertidos para intervalos em minutos.
 * Uma única instrução (UNION ALL) = um único snapshot consistente e um round-trip.
 * Usa os índices reservas_agenda_idx e bloqueios_data_idx.
 *
 * @returns {Promise<{ reservas: {inicio:number, fim:number, pessoas:number}[], bloqueios: {inicio:number, fim:number}[] }>}
 */
export async function buscarAgendaDoDia(executor, data) {
  const { rows } = await executor.query(
    `SELECT 'R' AS tipo,
            (EXTRACT(EPOCH FROM hora_inicio) / 60)::int               AS inicio,
            (EXTRACT(EPOCH FROM hora_inicio) / 60)::int + duracao_min AS fim,
            pessoas::int                                              AS pessoas
       FROM reservas
      WHERE data = $1::date
        AND status <> 'cancelada'
     UNION ALL
     SELECT 'B',
            (EXTRACT(EPOCH FROM hora_inicio) / 60)::int,
            (EXTRACT(EPOCH FROM hora_fim) / 60)::int,
            0
       FROM bloqueios
      WHERE data = $1::date`,
    [data],
  );

  const reservas = [];
  const bloqueios = [];
  for (const { tipo, inicio, fim, pessoas } of rows) {
    if (tipo === 'R') reservas.push({ inicio, fim, pessoas });
    else bloqueios.push({ inicio, fim });
  }
  return { reservas, bloqueios };
}

/** Quantas reservas futuras confirmadas este e-mail OU telefone já possui (anti-açambarcamento). */
export async function contarReservasAtivasDoContato(executor, { email, telefone, aPartirDe }) {
  const { rows } = await executor.query(
    `SELECT count(*)::int AS total
       FROM reservas
      WHERE status = 'confirmada'
        AND data >= $3::date
        AND (email = $1 OR telefone = $2)`,
    [email, telefone, aPartirDe],
  );
  return rows[0].total;
}

/**
 * Insere a reserva. Se o código sorteado já existir, ON CONFLICT DO NOTHING
 * devolve zero linhas (retornamos null) SEM abortar a transação — o Service
 * apenas sorteia outro código e tenta de novo.
 */
export async function inserirReserva(client, r) {
  const { rows } = await client.query(
    `INSERT INTO reservas (codigo, data, hora_inicio, duracao_min, pessoas, nome, telefone, email)
     VALUES ($1, $2::date, $3::time, $4, $5, $6, $7, $8)
     ON CONFLICT (codigo) DO NOTHING
     RETURNING codigo,
               data,
               to_char(hora_inicio, 'HH24:MI') AS hora_inicio,
               duracao_min,
               pessoas,
               nome,
               status,
               criado_em`,
    [r.codigo, r.data, r.hora_inicio, r.duracao_min, r.pessoas, r.nome, r.telefone, r.email],
  );
  return rows[0] ?? null;
}
