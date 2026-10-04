/** Campo de formulário acessível: label, input e mensagem de erro ligados por id. */
export default function Campo({ id, rotulo, opcional, erro, largo, multilinha, ...props }) {
  const idErro = `${id}-erro`;
  const Controle = multilinha ? 'textarea' : 'input';
  return (
    <div className={`campo${largo ? ' campo--largo' : ''}`}>
      <label htmlFor={id}>
        {rotulo} {opcional && <span className="opcional">(opcional)</span>}
      </label>
      <Controle id={id} aria-invalid={erro ? true : undefined} aria-describedby={erro ? idErro : undefined} {...props} />
      {erro && <p id={idErro} className="campo__erro">{erro}</p>}
    </div>
  );
}

export function Aceite({ name, checked, onChange, erro, children }) {
  return (
    <>
      <label className="aceite campo--largo">
        <input type="checkbox" name={name} checked={checked} onChange={onChange} aria-invalid={erro ? true : undefined} required />
        <span>{children}</span>
      </label>
      {erro && <p className="campo__erro campo--largo">{erro}</p>}
    </>
  );
}
