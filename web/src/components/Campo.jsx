import { IconeCheck } from './Icones.jsx';

/**
 * Campo acessível: label, controle e mensagem de erro ligados por id.
 * `valido` mostra um check discreto depois que a pessoa preencheu certo (validação em tempo real).
 */
export default function Campo({ id, rotulo, opcional, erro, valido, largo, multilinha, dica, ...props }) {
  const idErro = `${id}-erro`;
  const idDica = `${id}-dica`;
  const Controle = multilinha ? 'textarea' : 'input';
  const descritores = [erro && idErro, dica && idDica].filter(Boolean).join(' ') || undefined;
  return (
    <div className={`campo${largo ? ' campo--largo' : ''}`}>
      <label htmlFor={id}>
        {rotulo} {opcional && <span className="opcional">(opcional)</span>}
      </label>
      <div className="campo__controle">
        <Controle id={id} aria-invalid={erro ? true : undefined} aria-describedby={descritores} {...props} />
        {valido && !erro && <IconeCheck className="campo__ok" />}
      </div>
      {dica && !erro && <p id={idDica} className="campo__dica">{dica}</p>}
      {erro && <p id={idErro} className="campo__erro">{erro}</p>}
    </div>
  );
}
