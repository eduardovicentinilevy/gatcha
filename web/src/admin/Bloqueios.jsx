import { useState } from 'react';
import { agoraNoCafe, rotuloDia } from '../util.js';
import { admin } from './api.js';
import { Aviso, Carregando, HORAS, tratarErroDeFormulario, useCarregar } from './comum.jsx';

export default function Bloqueios() {
  const hoje = agoraNoCafe().data;
  const vazio = { data: hoje, hora_inicio: '13:00', hora_fim: '14:00', motivo: '' };
  const [form, setForm] = useState(vazio);
  const [erros, setErros] = useState({});
  const [aviso, setAviso] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const estado = useCarregar(() => admin('GET', '/bloqueios'), []);

  const alterar = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  async function criar(e) {
    e.preventDefault();
    setErros({});
    setAviso(null);
    setEnviando(true);
    try {
      const { reservas_afetadas: afetadas } = await admin('POST', '/bloqueios', { ...form, motivo: form.motivo || null });
      setAviso(
        afetadas > 0
          ? { tipo: 'erro', texto: `Bloqueado. Atenção: ${afetadas} ${afetadas === 1 ? 'reserva confirmada continua' : 'reservas confirmadas continuam'} nesse horário. Avise as pessoas ou cancele em Reservas.` }
          : { tipo: 'ok', texto: 'Horário bloqueado. Ninguém mais consegue reservar nesse intervalo.' },
      );
      setForm((f) => ({ ...vazio, data: f.data }));
      estado.recarregar();
    } catch (erro) {
      tratarErroDeFormulario(erro, setErros, setAviso);
    } finally {
      setEnviando(false);
    }
  }

  async function apagar(b) {
    if (!window.confirm(`Liberar ${rotuloDia(b.data).curto}, ${b.hora_inicio}–${b.hora_fim}?`)) return;
    try {
      await admin('DELETE', `/bloqueios/${b.id}`);
      setAviso({ tipo: 'ok', texto: 'Bloqueio removido. O horário voltou a aceitar reservas.' });
      estado.recarregar();
    } catch (erro) {
      setAviso({ tipo: 'erro', texto: erro.message });
    }
  }

  const lista = estado.dados?.bloqueios ?? [];
  return (
    <section aria-labelledby="titulo-bloqueios">
      <div className="admin__cabecalho"><h1 id="titulo-bloqueios">Bloqueios</h1></div>
      <p className="nota">Fecha horários do gatil (evento, limpeza, gatos descansando). Quem já reservou continua com a reserva.</p>

      <form className="cartao admin-form" onSubmit={criar} noValidate>
        <h2>Bloquear horário</h2>
        <div className="admin-form__grade">
          <label className="campo">Data
            <input type="date" name="data" min={hoje} value={form.data} onChange={alterar} required aria-invalid={erros.data ? true : undefined} />
            {erros.data && <span className="campo__erro">{erros.data}</span>}
          </label>
          <label className="campo">Das
            <select name="hora_inicio" value={form.hora_inicio} onChange={alterar}>{HORAS.slice(0, -1).map((h) => <option key={h}>{h}</option>)}</select>
          </label>
          <label className="campo">Até
            <select name="hora_fim" value={form.hora_fim} onChange={alterar} aria-invalid={erros.hora_fim ? true : undefined}>{HORAS.slice(1).map((h) => <option key={h}>{h}</option>)}</select>
            {erros.hora_fim && <span className="campo__erro">{erros.hora_fim}</span>}
          </label>
          <label className="campo admin-form__largo">Motivo <span className="opcional">(opcional, só a equipe vê)</span>
            <input name="motivo" maxLength={200} value={form.motivo} onChange={alterar} placeholder="Ex.: limpeza, evento fechado" />
          </label>
        </div>
        <button className="botao" disabled={enviando}>{enviando ? 'Bloqueando…' : 'Bloquear'}</button>
      </form>
      <Aviso aviso={aviso} />

      <h2 className="admin__subtitulo">Próximos bloqueios</h2>
      <Carregando estado={estado} vazio={estado.dados && lista.length === 0 ? 'Nenhum bloqueio daqui pra frente.' : null}>
        <ul className="admin-lista">
          {lista.map((b) => (
            <li key={b.id} className="cartao admin-item">
              <div className="admin-item__principal">
                <div>
                  <p className="admin-item__titulo">{rotuloDia(b.data).longo}</p>
                  <p className="admin-item__meta">{b.hora_inicio} às {b.hora_fim}{b.motivo ? ` · ${b.motivo}` : ''}</p>
                </div>
              </div>
              <div className="admin-item__acoes">
                <button type="button" className="botao botao--pequeno botao--secundario" onClick={() => apagar(b)}>Liberar</button>
              </div>
            </li>
          ))}
        </ul>
      </Carregando>
    </section>
  );
}
