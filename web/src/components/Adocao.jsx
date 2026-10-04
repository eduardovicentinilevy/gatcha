import { useEffect, useRef, useState } from 'react';
import { api, ErroApi } from '../api.js';
import { GATOS_EXEMPLO } from '../dados-exemplo.js';
import { focarPrimeiroErro, idade } from '../util.js';
import Campo, { Aceite } from './Campo.jsx';
import { TracoGato } from './LogoGato.jsx';

const CORES_AVATAR = ['#6BA305', '#4A7304', '#0D1117', '#8DB33A'];

/** Só aceita fotos HTTPS (a API também valida); qualquer outra coisa vira o avatar desenhado. */
function Foto({ gato, indice }) {
  if (typeof gato.foto_url === 'string' && gato.foto_url.startsWith('https://')) {
    return <img className="gato__foto" src={gato.foto_url} alt={`Foto de ${gato.nome}`} loading="lazy" decoding="async" referrerPolicy="no-referrer" />;
  }
  return (
    <div className="gato__avatar" role="img" aria-label={`Ilustração de ${gato.nome}`} style={{ background: CORES_AVATAR[indice % CORES_AVATAR.length] }}>
      <TracoGato />
    </div>
  );
}

export default function Adocao() {
  const [gatos, setGatos] = useState(null);
  const [exemplo, setExemplo] = useState(false);
  const [escolhido, setEscolhido] = useState(null);

  useEffect(() => {
    const controle = new AbortController();
    api
      .gatos(controle.signal)
      .then(({ gatos }) => setGatos(gatos))
      .catch(() => {
        if (controle.signal.aborted) return;
        setGatos(GATOS_EXEMPLO);
        setExemplo(true);
      });
    return () => controle.abort();
  }, []);

  const disponiveis = gatos?.filter((g) => g.status !== 'adotado');

  return (
    <section id="adocao" className="secao" aria-labelledby="titulo-adocao">
      <div className="container">
        <header className="secao__topo">
          <p className="sobretitulo">Adoção</p>
          <h2 id="titulo-adocao">Eles estão procurando uma família</h2>
          <p>Todos os gatos são castrados, vacinados e acompanhados pela ONG Abrigo São Gabriel. Gostou de alguém? Conte pra gente.</p>
        </header>
        <ul className="gatos" aria-live="polite">
          {!disponiveis && [1, 2, 3].map((n) => <li key={n} className="esqueleto" />)}
          {disponiveis?.length === 0 && <li className="nota">Todos os gatos foram adotados! Volte em breve para conhecer os novos moradores.</li>}
          {disponiveis?.map((g, i) => (
            <li key={g.id} className="gato">
              <Foto gato={g} indice={i} />
              <div className="gato__corpo">
                <h3>{g.nome}</h3>
                <div className="gato__meta">
                  {idade(g.idade_meses) && <span className="etiqueta">{idade(g.idade_meses)}</span>}
                  <span className="etiqueta">{g.sexo === 'femea' ? 'Fêmea' : 'Macho'}</span>
                  {g.status === 'em_processo' && <span className="etiqueta etiqueta--processo">Em processo de adoção</span>}
                </div>
                {g.personalidade && <p>{g.personalidade}</p>}
                <button type="button" className="botao botao--contorno" onClick={() => setEscolhido(g)}>Quero conhecer {g.nome}</button>
              </div>
            </li>
          ))}
        </ul>
        {exemplo && <p className="nota">Prévia da galeria com gatos ilustrativos. Em breve, os gatos reais do Abrigo São Gabriel.</p>}
      </div>
      <DialogoInteresse gato={escolhido} onFechar={() => setEscolhido(null)} />
    </section>
  );
}

const VAZIO = { nome: '', contato: '', mensagem: '', aceite: false };

function DialogoInteresse({ gato, onFechar }) {
  const dialogo = useRef(null);
  const form = useRef(null);
  const [dados, setDados] = useState(VAZIO);
  const [erros, setErros] = useState({});
  const [aviso, setAviso] = useState(null); // { tipo: 'ok' | 'erro', texto }
  const [enviando, setEnviando] = useState(false);

  // <dialog> nativo: foco preso no modal, Esc fecha, fundo inerte.
  useEffect(() => {
    if (gato) {
      setDados(VAZIO);
      setErros({});
      setAviso(null);
      dialogo.current?.showModal();
    } else {
      dialogo.current?.close();
    }
  }, [gato]);

  const alterar = (e) => {
    const { name, type, checked, value } = e.target;
    setDados((d) => ({ ...d, [name]: type === 'checkbox' ? checked : value }));
  };

  async function enviar(e) {
    e.preventDefault();
    if (enviando) return;
    setAviso(null);
    const limpos = {
      gato_id: gato.id,
      nome: dados.nome.trim().replace(/\s+/g, ' '),
      contato: dados.contato.trim(),
      mensagem: dados.mensagem.trim() || undefined,
    };
    const e2 = {};
    if (limpos.nome.length < 2) e2.nome = 'Informe seu nome.';
    if (limpos.contato.length < 8) e2.contato = 'Informe um e-mail ou celular.';
    if (!dados.aceite) e2.aceite = 'É preciso autorizar o envio à ONG.';
    setErros(e2);
    if (Object.keys(e2).length > 0) {
      focarPrimeiroErro(form.current, e2);
      return;
    }

    setEnviando(true);
    try {
      await api.registrarInteresse(limpos);
      setAviso({ tipo: 'ok', texto: 'Recebemos seu interesse! A equipe vai repassar à ONG, que entrará em contato.' });
      setDados(VAZIO);
    } catch (erro) {
      if (erro instanceof ErroApi && erro.codigo === 'DADOS_INVALIDOS') setErros(erro.errosDeCampo);
      setAviso({
        tipo: 'erro',
        texto: erro instanceof ErroApi && erro.status === 404 ? 'O formulário online ainda não está disponível. Fale com a equipe no café!' : erro.message,
      });
    } finally {
      setEnviando(false);
    }
  }

  return (
    <dialog ref={dialogo} className="dialogo" aria-labelledby="titulo-interesse" onClose={onFechar}>
      <form method="dialog" className="dialogo__fechar"><button aria-label="Fechar">×</button></form>
      <h3 id="titulo-interesse">Quero conhecer {gato?.nome}</h3>
      <form ref={form} className="campos" noValidate onSubmit={enviar}>
        <Campo id="i-nome" rotulo="Seu nome" name="nome" autoComplete="name" required maxLength={100} value={dados.nome} onChange={alterar} erro={erros.nome} largo />
        <Campo id="i-contato" rotulo="E-mail ou celular" name="contato" autoComplete="email" required maxLength={254} value={dados.contato} onChange={alterar} erro={erros.contato} largo />
        <Campo id="i-mensagem" rotulo="Mensagem" opcional name="mensagem" multilinha rows={3} maxLength={1000} value={dados.mensagem} onChange={alterar} largo />
        <Aceite name="aceite" checked={dados.aceite} onChange={alterar} erro={erros.aceite}>
          Autorizo o envio dos meus dados à ONG Abrigo São Gabriel para o processo de adoção (<a href="/privacidade" target="_blank" rel="noopener">aviso de privacidade</a>).
        </Aceite>
        {aviso && <p className={`alerta campo--largo${aviso.tipo === 'ok' ? ' alerta--ok' : ''}`} role="alert">{aviso.texto}</p>}
        <button className="botao campo--largo" type="submit" disabled={enviando}>{enviando ? 'Enviando…' : 'Enviar interesse'}</button>
      </form>
    </dialog>
  );
}
