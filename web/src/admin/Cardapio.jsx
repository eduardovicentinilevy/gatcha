import { useMemo, useState } from 'react';
import Campo from '../components/Campo.jsx';
import { reais } from '../util.js';
import { admin } from './api.js';
import { Aviso, Carregando, deCentavos, paraCentavos, tratarErroDeFormulario, useCarregar } from './comum.jsx';

const SELOS = { mais_pedido: 'Mais pedido', vegano: 'Vegano', novo: 'Novo' };
const VAZIO = { categoria: '', nome: '', descricao: '', preco: '', selos: [], ativo: true, foto_url: '' };

export default function Cardapio() {
  const estado = useCarregar(() => admin('GET', '/cardapio'), []);
  const [editando, setEditando] = useState(null);
  const [aviso, setAviso] = useState(null);
  const itens = estado.dados?.itens ?? [];
  const categorias = useMemo(() => [...new Set(itens.map((i) => i.categoria))], [itens]);

  async function acao(texto, fn) {
    setAviso(null);
    try {
      await fn();
      setAviso({ tipo: 'ok', texto });
      estado.recarregar();
    } catch (erro) {
      setAviso({ tipo: 'erro', texto: erro.message });
    }
  }

  return (
    <section aria-labelledby="titulo-cardapio">
      <div className="admin__cabecalho">
        <h1 id="titulo-cardapio">Cardápio</h1>
        <button type="button" className="botao botao--pequeno" onClick={() => setEditando('novo')}>Novo item</button>
      </div>
      <p className="nota">Itens desativados somem do site, sem perder o cadastro.</p>
      {editando && (
        <FormItem
          item={editando === 'novo' ? null : editando}
          categorias={categorias}
          onFechar={() => setEditando(null)}
          onSalvo={(texto) => { setEditando(null); setAviso({ tipo: 'ok', texto }); estado.recarregar(); }}
        />
      )}
      <Aviso aviso={aviso} />
      <Carregando estado={estado} vazio={estado.dados && itens.length === 0 ? 'Nenhum item cadastrado ainda.' : null}>
        {categorias.map((cat) => (
          <div key={cat} className="admin-dia">
            <h2 className="admin-dia__titulo">{cat}</h2>
            <ul className="admin-lista">
              {itens.filter((i) => i.categoria === cat).map((i) => (
                <li key={i.id} className={`cartao admin-item${i.ativo ? '' : ' admin-item--cancelada'}`}>
                  <div className="admin-item__principal">
                    <p className="admin-item__hora">{reais(i.preco_centavos)}</p>
                    <div>
                      <p className="admin-item__titulo">{i.nome}</p>
                      {i.descricao && <p className="admin-item__meta">{i.descricao}</p>}
                      {i.selos.length > 0 && <p className="admin-item__meta">{i.selos.map((s) => SELOS[s]).join(' · ')}</p>}
                    </div>
                  </div>
                  <div className="admin-item__acoes">
                    {!i.ativo && <span className="selo admin-status admin-status--cancelada">Fora do site</span>}
                    <button type="button" className="botao botao--pequeno" onClick={() => setEditando(i)}>Editar</button>
                    <button type="button" className="botao botao--pequeno botao--secundario" onClick={() => acao(i.ativo ? `${i.nome} saiu do site.` : `${i.nome} voltou pro site.`, () => admin('PATCH', `/cardapio/${i.id}`, { ativo: !i.ativo }))}>
                      {i.ativo ? 'Tirar do site' : 'Pôr no site'}
                    </button>
                    <button type="button" className="botao botao--pequeno botao--secundario" onClick={() => window.confirm(`Apagar ${i.nome}? Isso não pode ser desfeito.`) && acao(`${i.nome} apagado.`, () => admin('DELETE', `/cardapio/${i.id}`))}>
                      Apagar
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </Carregando>
    </section>
  );
}

function FormItem({ item, categorias, onFechar, onSalvo }) {
  const [form, setForm] = useState(() =>
    item ? { ...VAZIO, ...item, descricao: item.descricao ?? '', foto_url: item.foto_url ?? '', preco: deCentavos(item.preco_centavos) } : VAZIO,
  );
  const [erros, setErros] = useState({});
  const [aviso, setAviso] = useState(null);
  const [enviando, setEnviando] = useState(false);

  const alterar = (e) => {
    const { name, value, checked, type } = e.target;
    if (name === 'selos') setForm((f) => ({ ...f, selos: checked ? [...f.selos, value] : f.selos.filter((s) => s !== value) }));
    else setForm((f) => ({ ...f, [name]: type === 'checkbox' ? checked : value }));
  };

  async function salvar(e) {
    e.preventDefault();
    setErros({});
    setAviso(null);
    const preco = paraCentavos(form.preco);
    if (preco === null) {
      setErros({ preco_centavos: 'Use um valor como 22 ou 22,50' });
      return;
    }
    const corpo = {
      categoria: form.categoria, nome: form.nome, descricao: form.descricao || null, preco_centavos: preco,
      selos: form.selos, ativo: form.ativo, foto_url: form.foto_url.trim() || null,
    };
    setEnviando(true);
    try {
      if (item) await admin('PATCH', `/cardapio/${item.id}`, corpo);
      else await admin('POST', '/cardapio', corpo);
      onSalvo(item ? `${form.nome} atualizado.` : `${form.nome} adicionado ao cardápio.`);
    } catch (erro) {
      tratarErroDeFormulario(erro, setErros, setAviso);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form className="cartao admin-form" onSubmit={salvar} noValidate aria-labelledby="titulo-form-item">
      <h2 id="titulo-form-item">{item ? `Editar ${item.nome}` : 'Novo item'}</h2>
      <Aviso aviso={aviso} />
      <div className="campos">
        <Campo id="item-categoria" rotulo="Categoria" name="categoria" list="categorias-cardapio" value={form.categoria} onChange={alterar} erro={erros.categoria} maxLength={40} dica="Ex.: Bebidas, Doces, Salgados" />
        <datalist id="categorias-cardapio">{categorias.map((c) => <option key={c} value={c} />)}</datalist>
        <Campo id="item-nome" rotulo="Nome" name="nome" value={form.nome} onChange={alterar} erro={erros.nome} maxLength={100} />
        <Campo id="item-preco" rotulo="Preço (R$)" name="preco" inputMode="decimal" value={form.preco} onChange={alterar} erro={erros.preco_centavos} placeholder="22,00" />
        <Campo id="item-foto" rotulo="Foto" opcional name="foto_url" value={form.foto_url} onChange={alterar} erro={erros.foto_url} dica="Link https:// ou /img/cardapio/arquivo.jpg" />
        <Campo id="item-descricao" rotulo="Descrição" opcional multilinha largo name="descricao" value={form.descricao} onChange={alterar} erro={erros.descricao} maxLength={500} />
        <fieldset className="admin-form__largo admin-selos">
          <legend>Selos</legend>
          {Object.entries(SELOS).map(([v, t]) => (
            <label key={v} className="aceite"><input type="checkbox" name="selos" value={v} checked={form.selos.includes(v)} onChange={alterar} /> {t}</label>
          ))}
          <label className="aceite"><input type="checkbox" name="ativo" checked={form.ativo} onChange={alterar} /> Aparece no site</label>
        </fieldset>
      </div>
      <div className="admin-form__acoes">
        <button type="button" className="botao botao--secundario" onClick={onFechar}>Cancelar</button>
        <button className="botao" disabled={enviando}>{enviando ? 'Salvando…' : 'Salvar'}</button>
      </div>
    </form>
  );
}
