import { useEffect, useMemo, useRef, useState } from 'react';
import qrcode from 'qrcode-generator';
import Campo from '../components/Campo.jsx';
import { admin, definirToken } from './api.js';
import { Aviso } from './comum.jsx';

/** QR code em imagem (data: URL), sem HTML injetado. */
function QrCode({ texto }) {
  const src = useMemo(() => {
    const qr = qrcode(0, 'M');
    qr.addData(texto);
    qr.make();
    return qr.createDataURL(5, 2);
  }, [texto]);
  return <img className="dois-fatores__qr" src={src} alt="QR code para cadastrar o Gatchá no app autenticador" />;
}

/**
 * Segurança da própria conta: verificação em duas etapas (app autenticador).
 * Ativar: o servidor gera o segredo, a pessoa cadastra no app e confirma com o código + a senha.
 * Desativar: senha + código atual (quem pegou a sessão emprestada não tira a proteção).
 */
export default function MinhaConta({ usuario, onAtualizarUsuario }) {
  const ativo = usuario.dois_fatores;
  const [ativacao, setAtivacao] = useState(null); // { chave, link } enquanto ativa
  const [desativando, setDesativando] = useState(false);
  const [senha, setSenha] = useState('');
  const [codigo, setCodigo] = useState('');
  const [aviso, setAviso] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const titulo = useRef(null);

  const emAndamento = Boolean(ativacao) || desativando;
  const codigoCompleto = codigo.replace(/\D/g, '').length === 6;

  useEffect(() => {
    if (emAndamento) titulo.current?.focus();
  }, [emAndamento]);

  function limpar() {
    setAtivacao(null);
    setDesativando(false);
    setSenha('');
    setCodigo('');
  }

  async function comecarAtivacao() {
    setAviso(null);
    setEnviando(true);
    try {
      setAtivacao(await admin('POST', '/2fa/iniciar'));
    } catch (erro) {
      setAviso({ tipo: 'erro', texto: erro.message });
    } finally {
      setEnviando(false);
    }
  }

  async function confirmar(e) {
    e.preventDefault();
    if (enviando) return;
    setAviso(null);
    setEnviando(true);
    try {
      const resposta = await admin('POST', ativo ? '/2fa/desativar' : '/2fa/ativar', { senha, codigo });
      definirToken(resposta.token);
      onAtualizarUsuario(resposta.usuario);
      limpar();
      setAviso({
        tipo: 'ok',
        texto: ativo
          ? 'Verificação em duas etapas desativada. As outras sessões abertas foram encerradas.'
          : 'Pronto! A partir de agora o login pede o código do app. As outras sessões abertas foram encerradas.',
      });
    } catch (erro) {
      setAviso({ tipo: 'erro', texto: erro.message });
      setCodigo('');
      if (erro.codigo === 'ATIVACAO_EXPIRADA') limpar();
    } finally {
      setEnviando(false);
    }
  }

  return (
    <section aria-labelledby="titulo-conta">
      <div className="admin__cabecalho">
        <h1 id="titulo-conta">Minha conta</h1>
      </div>
      <p className="nota">Entrou como <strong>{usuario.email}</strong>.</p>
      <Aviso aviso={aviso} />

      <div className="cartao dois-fatores">
        <div className="dois-fatores__topo">
          <span className="dois-fatores__icone" aria-hidden="true">{ativo ? '🔒' : '🔓'}</span>
          <div>
            <h2 ref={titulo} tabIndex={-1}>Verificação em duas etapas</h2>
            <p className={`selo admin-status ${ativo ? 'admin-status--disponivel' : 'admin-status--fora'}`}>{ativo ? 'Ativada' : 'Desativada'}</p>
          </div>
        </div>
        <p className="dois-fatores__texto">
          Além da senha, o login pede um código de 6 números que muda a cada 30 segundos no celular
          (Google Authenticator, Microsoft Authenticator, Authy…). Se alguém descobrir sua senha, ainda assim não entra.
        </p>

        {!emAndamento && (
          ativo ? (
            <button type="button" className="botao botao--secundario" onClick={() => { setAviso(null); setDesativando(true); }}>Desativar</button>
          ) : (
            <button type="button" className="botao" onClick={comecarAtivacao} disabled={enviando}>{enviando ? 'Gerando…' : 'Ativar no meu celular'}</button>
          )
        )}

        {ativacao && (
          <ol className="dois-fatores__passos">
            <li>
              <strong>Abra o app autenticador</strong> no celular e toque em <strong>+</strong>.
            </li>
            <li>
              <strong>Escaneie o QR code</strong>
              <div className="dois-fatores__cadastro">
                <QrCode texto={ativacao.link} />
                <p>
                  Não dá pra escanear? Escolha <em>“Inserir chave de configuração”</em> e digite:
                  <code className="dois-fatores__chave">{ativacao.chave.match(/.{1,4}/g).join(' ')}</code>
                  <span className="campo__dica">Conta: Gatchá · Tipo: baseado em tempo</span>
                </p>
              </div>
            </li>
            <li><strong>Confirme</strong> com o código que apareceu no app e a sua senha (vale por {ativacao.validade_minutos} minutos).</li>
          </ol>
        )}

        {emAndamento && (
          <form className="dois-fatores__form" onSubmit={confirmar} noValidate>
            <div className="campos">
              <Campo
                id="conta-codigo"
                rotulo="Código do app"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={7}
                value={codigo}
                onChange={(e) => setCodigo(e.target.value.replace(/[^\d ]/g, ''))}
                required
              />
              <Campo id="conta-senha" rotulo="Sua senha" type="password" autoComplete="current-password" value={senha} onChange={(e) => setSenha(e.target.value)} required />
            </div>
            <div className="admin-form__acoes">
              <button type="button" className="botao botao--secundario" onClick={() => { limpar(); setAviso(null); }}>Cancelar</button>
              <button className="botao" disabled={enviando || !senha || !codigoCompleto}>
                {enviando ? 'Conferindo…' : ativo ? 'Desativar' : 'Ativar verificação'}
              </button>
            </div>
          </form>
        )}

        <p className="nota">Perdeu ou trocou de celular? Peça a quem administra o sistema para desativar a verificação da sua conta e ative de novo aqui.</p>
      </div>
    </section>
  );
}
