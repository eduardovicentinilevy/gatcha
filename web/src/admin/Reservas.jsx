import { useMemo, useState } from 'react';
import { agoraNoCafe, rotuloDia } from '../util.js';
import { admin } from './api.js';
import { Aviso, Carregando, somarDias, useCarregar } from './comum.jsx';

const STATUS = { confirmada: 'Confirmada', compareceu: 'Compareceu', cancelada: 'Cancelada' };

export default function Reservas() {
  const hoje = agoraNoCafe().data;
  const [filtro, setFiltro] = useState({ de: hoje, ate: somarDias(hoje, 7), status: '' });
  const [aviso, setAviso] = useState(null);
  const consulta = new URLSearchParams(Object.entries(filtro).filter(([, v]) => v)).toString();
  const estado = useCarregar(() => admin('GET', `/reservas?${consulta}`), [consulta]);

  const porDia = useMemo(() => {
    const grupos = new Map();
    for (const r of estado.dados?.reservas ?? []) {
      if (!grupos.has(r.data)) grupos.set(r.data, []);
      grupos.get(r.data).push(r);
    }
    return [...grupos];
  }, [estado.dados]);

  async function mudar(reserva, status, pergunta) {
    if (pergunta && !window.confirm(pergunta)) return;
    setAviso(null);
    try {
      await admin('PATCH', `/reservas/${reserva.codigo}`, { status });
      setAviso({ tipo: 'ok', texto: `${reserva.codigo}: ${STATUS[status].toLowerCase()}.` });
      estado.recarregar();
    } catch (erro) {
      setAviso({ tipo: 'erro', texto: erro.message });
    }
  }

  const alterarFiltro = (e) => setFiltro((f) => ({ ...f, [e.target.name]: e.target.value }));

  return (
    <section aria-labelledby="titulo-reservas">
      <div className="admin__cabecalho">
        <h1 id="titulo-reservas">Reservas</h1>
        <button type="button" className="botao botao--pequeno botao--secundario" onClick={estado.recarregar}>Atualizar</button>
      </div>
      <form className="admin-filtros" onSubmit={(e) => e.preventDefault()}>
        <label>De <input type="date" name="de" value={filtro.de} onChange={alterarFiltro} required /></label>
        <label>Até <input type="date" name="ate" value={filtro.ate} min={filtro.de} onChange={alterarFiltro} required /></label>
        <label>
          Status
          <select name="status" value={filtro.status} onChange={alterarFiltro}>
            <option value="">Todos</option>
            {Object.entries(STATUS).map(([v, t]) => <option key={v} value={v}>{t}</option>)}
          </select>
        </label>
      </form>
      <Aviso aviso={aviso} />

      <Carregando estado={estado} vazio={estado.dados && porDia.length === 0 ? 'Nenhuma reserva nesse período.' : null}>
        {porDia.map(([data, reservas]) => {
          const pessoas = reservas.filter((r) => r.status !== 'cancelada').reduce((s, r) => s + r.pessoas, 0);
          return (
            <div key={data} className="admin-dia">
              <h2 className="admin-dia__titulo">
                {rotuloDia(data).longo}
                <span>{pessoas} {pessoas === 1 ? 'pessoa' : 'pessoas'}</span>
              </h2>
              <ul className="admin-lista">
                {reservas.map((r) => (
                  <li key={r.codigo} className={`cartao admin-item admin-item--${r.status}`}>
                    <div className="admin-item__principal">
                      <p className="admin-item__hora">{r.hora_inicio}</p>
                      <div>
                        <p className="admin-item__titulo">{r.nome}</p>
                        <p className="admin-item__meta">
                          {r.pessoas} {r.pessoas === 1 ? 'pessoa' : 'pessoas'} · {r.duracao_min} min · <span className="admin-codigo">{r.codigo}</span>
                        </p>
                        <p className="admin-item__meta">
                          <a href={`tel:+55${r.telefone}`}>{formatarTelefone(r.telefone)}</a> · <a href={`mailto:${r.email}`}>{r.email}</a>
                        </p>
                      </div>
                    </div>
                    <div className="admin-item__acoes">
                      <span className={`selo admin-status admin-status--${r.status}`}>{STATUS[r.status]}</span>
                      {r.status === 'confirmada' && (
                        <>
                          <button type="button" className="botao botao--pequeno" onClick={() => mudar(r, 'compareceu')}>Chegou</button>
                          <button type="button" className="botao botao--pequeno botao--secundario" onClick={() => mudar(r, 'cancelada', `Cancelar a reserva de ${r.nome} (${r.hora_inicio})? A vaga volta pra agenda e isso não pode ser desfeito.`)}>
                            Cancelar
                          </button>
                        </>
                      )}
                      {r.status === 'compareceu' && (
                        <button type="button" className="botao botao--pequeno botao--secundario" onClick={() => mudar(r, 'confirmada')}>Desfazer</button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </Carregando>
    </section>
  );
}

function formatarTelefone(t) {
  return t.length === 11 ? `(${t.slice(0, 2)}) ${t.slice(2, 7)}-${t.slice(7)}` : `(${t.slice(0, 2)}) ${t.slice(2, 6)}-${t.slice(6)}`;
}
