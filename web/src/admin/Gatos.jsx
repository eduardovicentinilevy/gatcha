import { useRef, useState } from 'react';
import Campo from '../components/Campo.jsx';
import { IconePatinha } from '../components/Icones.jsx';
import CampoFoto from './CampoFoto.jsx';
import { idade } from '../util.js';
import { admin } from './api.js';
import { Aviso, Carregando, tratarErroDeFormulario, useCarregar } from './comum.jsx';

const STATUS = { disponivel: 'Disponível', em_processo: 'Em processo', adotado: 'Adotado' };
const VAZIO = { nome: '', sexo: 'femea', idade_meses: '', personalidade: '', foto_url: '', status: 'disponivel' };

export default function Gatos() {
  const estado = useCarregar(() => admin('GET', '/gatos'), []);
  const [editando, setEditando] = useState(null); // null = fechado | 'novo' | gato
  const [aviso, setAviso] = useState(null);
  const lista = estado.dados?.gatos ?? [];

  async function apagar(g) {
    if (!window.confirm(`Apagar ${g.nome}? Isso não pode ser desfeito.`)) return;
    try {
      await admin('DELETE', `/gatos/${g.id}`);
      setAviso({ tipo: 'ok', texto: `${g.nome} foi apagado.` });
      estado.recarregar();
    } catch (erro) {
      setAviso({ tipo: 'erro', texto: erro.message });
    }
  }

  return (
    <section aria-labelledby="titulo-gatos">
      <div className="admin__cabecalho">
        <h1 id="titulo-gatos">Gatos</h1>
        <button type="button" className="botao botao--pequeno" onClick={() => setEditando('novo')}>Novo gato</button>
      </div>
      <p className="nota">Gatos adotados saem do site, mas continuam aqui.</p>
      {editando && (
        <FormGato
          gato={editando === 'novo' ? null : editando}
          onFechar={() => setEditando(null)}
          onSalvo={(texto) => { setEditando(null); setAviso({ tipo: 'ok', texto }); estado.recarregar(); }}
        />
      )}
      <Aviso aviso={aviso} />
      <Carregando estado={estado} vazio={estado.dados && lista.length === 0 ? 'Nenhum gato cadastrado ainda.' : null}>
        <ul className="admin-lista">
          {lista.map((g) => (
            <li key={g.id} className={`cartao admin-item${g.status === 'adotado' ? ' admin-item--cancelada' : ''}`}>
              <div className="admin-item__principal">
                <Miniatura url={g.foto_url} />
                <div>
                  <p className="admin-item__titulo">{g.nome}</p>
                  <p className="admin-item__meta">{[idade(g.idade_meses), g.sexo === 'femea' ? 'fêmea' : 'macho'].filter(Boolean).join(' · ')}</p>
                  {g.personalidade && <p className="admin-item__meta">{g.personalidade}</p>}
                </div>
              </div>
              <div className="admin-item__acoes">
                <span className={`selo admin-status admin-status--${g.status}`}>{STATUS[g.status]}</span>
                <button type="button" className="botao botao--pequeno" onClick={() => setEditando(g)}>Editar</button>
                <button type="button" className="botao botao--pequeno botao--secundario" onClick={() => apagar(g)}>Apagar</button>
              </div>
            </li>
          ))}
        </ul>
      </Carregando>
    </section>
  );
}

export function Miniatura({ url }) {
  return <div className="admin-miniatura">{url ? <img src={url} alt="" loading="lazy" /> : <IconePatinha aria-hidden="true" />}</div>;
}

function FormGato({ gato, onFechar, onSalvo }) {
  const [form, setForm] = useState(() => (gato ? { ...VAZIO, ...Object.fromEntries(Object.entries(gato).map(([k, v]) => [k, v ?? ''])) } : VAZIO));
  const [erros, setErros] = useState({});
  const [aviso, setAviso] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const titulo = useRef(null);

  const alterar = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  async function salvar(e) {
    e.preventDefault();
    setErros({});
    setAviso(null);
    const idadeNum = form.idade_meses === '' ? null : Number(form.idade_meses);
    const corpo = {
      nome: form.nome,
      sexo: form.sexo,
      idade_meses: Number.isInteger(idadeNum) || idadeNum === null ? idadeNum : form.idade_meses,
      personalidade: form.personalidade || null,
      foto_url: form.foto_url.trim() || null,
      status: form.status,
    };
    setEnviando(true);
    try {
      if (gato) await admin('PATCH', `/gatos/${gato.id}`, corpo);
      else await admin('POST', '/gatos', corpo);
      onSalvo(gato ? `${form.nome} atualizado.` : `${form.nome} cadastrado.`);
    } catch (erro) {
      tratarErroDeFormulario(erro, setErros, setAviso);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form className="cartao admin-form" onSubmit={salvar} noValidate aria-labelledby="titulo-form-gato">
      <h2 id="titulo-form-gato" ref={titulo}>{gato ? `Editar ${gato.nome}` : 'Novo gato'}</h2>
      <Aviso aviso={aviso} />
      <div className="campos">
        <Campo id="gato-nome" rotulo="Nome" name="nome" value={form.nome} onChange={alterar} erro={erros.nome} maxLength={60} required />
        <Campo id="gato-idade" rotulo="Idade em meses" opcional name="idade_meses" type="number" min="0" max="360" inputMode="numeric" value={form.idade_meses} onChange={alterar} erro={erros.idade_meses} dica="Ex.: 8 (8 meses), 24 (2 anos)" />
        <label className="campo">Sexo
          <select name="sexo" value={form.sexo} onChange={alterar}><option value="femea">Fêmea</option><option value="macho">Macho</option></select>
        </label>
        <label className="campo">Situação
          <select name="status" value={form.status} onChange={alterar}>{Object.entries(STATUS).map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select>
        </label>
        <Campo id="gato-personalidade" rotulo="Personalidade" opcional multilinha largo name="personalidade" value={form.personalidade} onChange={alterar} erro={erros.personalidade} maxLength={500} dica="Separe por vírgula: cada parte vira uma etiqueta no site (ex.: calmo, rei do colo)." />
        <CampoFoto id="gato-foto" valor={form.foto_url} onChange={(url) => setForm((f) => ({ ...f, foto_url: url }))} erro={erros.foto_url} />
      </div>
      <div className="admin-form__acoes">
        <button type="button" className="botao botao--secundario" onClick={onFechar}>Cancelar</button>
        <button className="botao" disabled={enviando}>{enviando ? 'Salvando…' : 'Salvar'}</button>
      </div>
    </form>
  );
}
