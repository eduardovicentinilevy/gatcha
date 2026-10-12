import { useState } from 'react';
import { admin } from './api.js';
import { Aviso, Carregando, useCarregar } from './comum.jsx';

const fmt = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' });

/** A API guarda o celular só com dígitos (DDD + número): "11987654321" -> "(11) 98765-4321". */
const telefone = (d) => `(${d.slice(0, 2)}) ${d.slice(2, -4)}-${d.slice(-4)}`;

export default function Interessados() {
  const [status, setStatus] = useState('novo');
  const [aviso, setAviso] = useState(null);
  const estado = useCarregar(() => admin('GET', `/interesses${status ? `?status=${status}` : ''}`), [status]);
  const lista = estado.dados?.interesses ?? [];

  async function marcar(i, novo) {
    try {
      await admin('PATCH', `/interesses/${i.id}`, { status: novo });
      setAviso({ tipo: 'ok', texto: novo === 'repassado' ? `Contato de ${i.nome} marcado como repassado à ONG.` : `${i.nome} voltou para "novos".` });
      estado.recarregar();
    } catch (erro) {
      setAviso({ tipo: 'erro', texto: erro.message });
    }
  }

  return (
    <section aria-labelledby="titulo-interessados">
      <div className="admin__cabecalho"><h1 id="titulo-interessados">Interessados em adoção</h1></div>
      <p className="nota">Quem clicou em "Quero conhecer". Repasse o contato ao Abrigo São Gabriel e marque aqui.</p>
      <form className="admin-filtros" onSubmit={(e) => e.preventDefault()}>
        <label>Mostrar
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="novo">Novos</option>
            <option value="repassado">Já repassados</option>
            <option value="">Todos</option>
          </select>
        </label>
      </form>
      <Aviso aviso={aviso} />
      <Carregando estado={estado} vazio={estado.dados && lista.length === 0 ? 'Ninguém por aqui.' : null}>
        <ul className="admin-lista">
          {lista.map((i) => (
            <li key={i.id} className="cartao admin-item">
              <div className="admin-item__principal">
                <div>
                  <p className="admin-item__titulo">{i.nome} <span className="admin-item__meta">quer conhecer {i.gato}</span></p>
                  <p className="admin-item__meta">
                    {i.contato.includes('@') ? <a href={`mailto:${i.contato}`}>{i.contato}</a> : <a href={`tel:+55${i.contato}`}>{telefone(i.contato)}</a>} · {fmt.format(new Date(i.criado_em))}
                  </p>
                  {i.mensagem && <p className="admin-item__mensagem">“{i.mensagem}”</p>}
                </div>
              </div>
              <div className="admin-item__acoes">
                {i.status === 'novo' ? (
                  <button type="button" className="botao botao--pequeno" onClick={() => marcar(i, 'repassado')}>Marcar repassado</button>
                ) : (
                  <button type="button" className="botao botao--pequeno botao--secundario" onClick={() => marcar(i, 'novo')}>Voltar para novos</button>
                )}
              </div>
            </li>
          ))}
        </ul>
      </Carregando>
    </section>
  );
}
