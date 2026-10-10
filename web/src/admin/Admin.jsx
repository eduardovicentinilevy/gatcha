import { lazy, Suspense, useEffect, useState } from 'react';
import { IconeLua, IconeSol } from '../components/Icones.jsx';
import LogoGato from '../components/LogoGato.jsx';
import Campo from '../components/Campo.jsx';
import { definirAoExpirar, entrar, sair } from './api.js';
import Gatos from './Gatos.jsx';
import Cardapio from './Cardapio.jsx';
import Interessados from './Interessados.jsx';

// O gerador de QR code só é baixado por quem abre "Minha conta".
const MinhaConta = lazy(() => import('./MinhaConta.jsx'));

const ABAS = [
  ['gatos', 'Gatos', Gatos],
  ['cardapio', 'Cardápio', Cardapio],
  ['interessados', 'Interessados', Interessados],
  ['conta', 'Minha conta', MinhaConta],
];

/** Painel da equipe: login + abas. O site público não tem link para cá e a página não é indexada. */
export default function Admin({ tema, onAlternarTema }) {
  const [usuario, setUsuario] = useState(null);
  const [motivoSaida, setMotivoSaida] = useState(null);
  const [aba, setAba] = useState('gatos');

  useEffect(() => {
    const meta = document.createElement('meta');
    meta.name = 'robots';
    meta.content = 'noindex, nofollow';
    document.head.append(meta);
    definirAoExpirar(() => {
      setUsuario(null);
      setMotivoSaida('Sua sessão expirou. Entre de novo para continuar.');
    });
    return () => meta.remove();
  }, []);

  function deslogar() {
    sair();
    setUsuario(null);
    setMotivoSaida(null);
  }

  const Aba = ABAS.find(([id]) => id === aba)[2];

  return (
    <div className="admin">
      <header className="admin__topo">
        <div className="container admin__topo-linha">
          <a className="admin__marca" href="/"><LogoGato tamanho={34} /> <span>Gatchá <small>painel</small></span></a>
          <div className="admin__topo-acoes">
            {usuario && <span className="admin__usuario">{usuario.email}</span>}
            <button type="button" className="botao-icone" onClick={onAlternarTema} aria-label={tema === 'escuro' ? 'Usar tema claro' : 'Usar tema escuro'}>
              {tema === 'escuro' ? <IconeSol /> : <IconeLua />}
            </button>
            {usuario && <button type="button" className="botao botao--pequeno botao--secundario" onClick={deslogar}>Sair</button>}
          </div>
        </div>
        {usuario && (
          <nav className="container admin__abas" aria-label="Seções do painel">
            {ABAS.map(([id, nome]) => (
              <button key={id} type="button" className="admin__aba" aria-current={aba === id ? 'page' : undefined} onClick={() => setAba(id)}>
                {nome}
              </button>
            ))}
          </nav>
        )}
      </header>

      <main id="conteudo" className="container admin__conteudo">
        {usuario ? (
          <Suspense fallback={<p className="vazio">Carregando…</p>}>
            <Aba usuario={usuario} onAtualizarUsuario={setUsuario} />
          </Suspense>
        ) : <Login aviso={motivoSaida} onEntrar={(u) => { setUsuario(u); setMotivoSaida(null); }} />}
      </main>
    </div>
  );
}

function Login({ aviso, onEntrar }) {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [codigo, setCodigo] = useState('');
  const [erro, setErro] = useState(null);
  const [enviando, setEnviando] = useState(false);

  async function enviar(e) {
    e.preventDefault();
    if (enviando) return;
    setErro(null);
    setEnviando(true);
    try {
      onEntrar(await entrar(email.trim(), senha, codigo.replace(/\s/g, '') || undefined));
    } catch (falha) {
      setErro(falha.message);
      setSenha('');
      setCodigo('');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <>
      <form className="cartao admin-login" onSubmit={enviar} noValidate aria-labelledby="titulo-login">
        <div className="admin-login__logo"><LogoGato tamanho={72} /></div>
        <div className="admin-login__topo">
          <h1 id="titulo-login">Área da equipe</h1>
          <p>Gatos, cardápio e pedidos de adoção do site, num lugar só.</p>
        </div>
        {(erro || aviso) && <p className="alerta" role="alert">{erro ?? aviso}</p>}
        <div className="campos">
          <Campo id="login-email" rotulo="E-mail" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required largo />
          <Campo id="login-senha" rotulo="Senha" type="password" autoComplete="current-password" value={senha} onChange={(e) => setSenha(e.target.value)} required largo />
          <Campo
            id="login-codigo"
            rotulo="Código do app autenticador"
            opcional
            dica="Só se a verificação em duas etapas estiver ativada na sua conta."
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={7}
            value={codigo}
            onChange={(e) => setCodigo(e.target.value.replace(/[^\d ]/g, ''))}
            largo
          />
        </div>
        <button className="botao botao--largo" disabled={enviando || !email || !senha}>{enviando ? 'Entrando…' : 'Entrar'}</button>
        <p className="nota">Por segurança, a sessão dura poucos minutos e não fica salva no navegador. Esqueceu a senha? Peça a quem administra o sistema para redefinir.</p>
      </form>
      <p className="admin-login__voltar"><a className="link" href="/">← Voltar ao site</a></p>
    </>
  );
}
