import { useEffect, useRef, useState } from 'react';
import { CONFIG } from '../config.js';
import { api, carregarGatos, ErroApi } from '../api.js';
import { focarPrimeiroErro, idade } from '../util.js';
import Campo, { Aceite } from './Campo.jsx';
import Carrossel from './Carrossel.jsx';
import Foto from './Foto.jsx';
import { IconeFechar } from './Icones.jsx';

const STATUS = {
  disponivel: ['Disponível', 'selo--matcha'],
  em_processo: ['Em processo de adoção', 'selo--destaque'],
};
const TONS = ['matcha', 'creme', 'rosa'];
const tags = (texto) => (texto ?? '').split(',').map((t) => t.trim()).filter(Boolean);

export default function Adocao() {
  const [gatos, setGatos] = useState(null);
  const [exemplo, setExemplo] = useState(false);
  const [escolhido, setEscolhido] = useState(null);

  const [falhou, setFalhou] = useState(false);
  const [tentativa, setTentativa] = useState(0);

  useEffect(() => {
    let vivo = true;
    setFalhou(false);
    carregarGatos()
      .then(({ lista, exemplo }) => {
        if (!vivo) return;
        setGatos(lista.filter((g) => g.status !== 'adotado'));
        setExemplo(exemplo);
      })
      .catch(() => vivo && setFalhou(true));
    return () => {
      vivo = false;
    };
  }, [tentativa]);

  return (
    <section id="adocao" className="secao" aria-labelledby="titulo-adocao">
      <div className="container">
        <header className="secao__topo" data-revelar>
          <p className="sobretitulo">Adoção</p>
          <h2 id="titulo-adocao">{CONFIG.textos.adocao.titulo}</h2>
          <p>{CONFIG.textos.adocao.subtitulo}</p>
        </header>

        {falhou && (
          <div className="vazio" role="alert">
            <p>Não deu pra carregar agora. Confere a internet?</p>
            <button type="button" className="botao" onClick={() => setTentativa((t) => t + 1)}>Tentar de novo</button>
          </div>
        )}
        {!gatos && !falhou && <div className="esqueleto esqueleto--card" />}
        {gatos?.length === 0 && <p className="vazio">Todo mundo foi adotado! 🎉 Volta logo pra conhecer os novos moradores.</p>}
        {gatos?.length > 0 && (
          <Carrossel
            rotulo="Gatos para adoção"
            itens={gatos}
            chave={(g) => g.id}
            classe="carrossel--gatos"
            renderItem={(g, i) => (
              <article className="gato cartao cartao--interativo">
                <div className="midia">
                  <Foto src={g.foto_url} alt={`Foto de ${g.nome}`} icone="gato" tom={TONS[i % TONS.length]} />
                  {STATUS[g.status] && <span className={`selo selo--adesivo ${STATUS[g.status][1]}`}>{STATUS[g.status][0]}</span>}
                </div>
                <div className="gato__corpo">
                  <h3>{g.nome}</h3>
                  <p className="gato__meta">{[idade(g.idade_meses), g.sexo === 'femea' ? 'fêmea' : 'macho'].filter(Boolean).join(' · ')}</p>
                  <ul className="tags" aria-label="Personalidade">
                    {tags(g.personalidade).map((t) => <li key={t} className="tag">{t}</li>)}
                  </ul>
                  <button type="button" className="botao" onClick={() => setEscolhido(g)}>Quero conhecer</button>
                </div>
              </article>
            )}
          />
        )}
        {exemplo && <p className="nota">Galeria ilustrativa: em breve, os gatos reais do Abrigo São Gabriel.</p>}

        <div className="ong cartao" data-revelar>
          <p className="ong__titulo">🤝 Parceria com o Abrigo São Gabriel</p>
          <p>
            A gente cuida do dia a dia no gatil; a ONG cuida da adoção responsável: entrevista, termo e acompanhamento.
            Mandou o “Quero conhecer”? Seu contato vai direto pra equipe deles.
          </p>
        </div>
      </div>
      <DialogoInteresse gato={escolhido} onFechar={() => setEscolhido(null)} />
    </section>
  );
}

const VAZIO = { nome: '', contato: '', mensagem: '', aceite: false };

function DialogoInteresse({ gato, onFechar }) {
  const dialogo = useRef(null);
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
    const novos = {};
    if (limpos.nome.length < 2) novos.nome = 'Como a gente te chama?';
    if (limpos.contato.length < 8) novos.contato = 'Deixa um e-mail ou celular pra ONG falar com você.';
    if (!dados.aceite) novos.aceite = 'Precisamos do seu ok pra enviar seus dados à ONG.';
    setErros(novos);
    if (Object.keys(novos).length > 0) {
      focarPrimeiroErro(e.currentTarget, novos);
      return;
    }

    setEnviando(true);
    try {
      await api.registrarInteresse(limpos);
      setAviso({ tipo: 'ok', texto: `Recebido! A equipe vai passar seu contato pro Abrigo São Gabriel. ${gato.nome} agradece 🐾` });
      setDados(VAZIO);
    } catch (erro) {
      if (erro instanceof ErroApi && erro.codigo === 'DADOS_INVALIDOS') setErros(erro.errosDeCampo);
      setAviso({
        tipo: 'erro',
        texto: erro instanceof ErroApi && erro.status === 404 ? 'O formulário online ainda não está no ar. Fala com a gente no café!' : erro.message,
      });
    } finally {
      setEnviando(false);
    }
  }

  return (
    <dialog ref={dialogo} className="dialogo cartao" aria-labelledby="titulo-interesse" onClose={onFechar}>
      <form method="dialog" className="dialogo__fechar">
        <button className="botao-icone" aria-label="Fechar"><IconeFechar /></button>
      </form>
      <h3 id="titulo-interesse">Quero conhecer {gato?.nome} 💚</h3>
      <form className="campos" noValidate onSubmit={enviar}>
        <Campo id="i-nome" rotulo="Seu nome" name="nome" autoComplete="name" maxLength={100} value={dados.nome} onChange={alterar} erro={erros.nome} largo />
        <Campo id="i-contato" rotulo="E-mail ou celular" name="contato" autoComplete="email" maxLength={254} value={dados.contato} onChange={alterar} erro={erros.contato} largo />
        <Campo id="i-mensagem" rotulo="Conta um pouco de você" opcional name="mensagem" multilinha rows={3} maxLength={1000} value={dados.mensagem} onChange={alterar} largo placeholder="Já tem outros pets? Mora em casa ou apê?" />
        <Aceite name="aceite" checked={dados.aceite} onChange={alterar} erro={erros.aceite}>
          Autorizo o envio dos meus dados ao Abrigo São Gabriel para o processo de adoção (<a href="/privacidade" target="_blank" rel="noopener">aviso de privacidade</a>).
        </Aceite>
        {aviso && <p className={`alerta campo--largo${aviso.tipo === 'ok' ? ' alerta--ok' : ''}`} role="alert">{aviso.texto}</p>}
        <button className="botao botao--grande campo--largo" type="submit" disabled={enviando}>{enviando ? 'Enviando…' : 'Enviar interesse'}</button>
      </form>
    </dialog>
  );
}
