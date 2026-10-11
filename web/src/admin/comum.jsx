import { useCallback, useEffect, useState } from 'react';
import { reais, reduzirMovimento } from '../util.js';

/**
 * Formulário recém-aberto: rola até ele (descontando a barra fixa do painel) e põe o foco
 * no título. Sem isso, "Editar" num item lá embaixo abria o formulário fora da tela.
 */
export function useMostrarAoAbrir(titulo) {
  useEffect(() => {
    const el = titulo.current;
    if (!el) return;
    const barra = document.querySelector('.admin__topo')?.offsetHeight ?? 0;
    const y = el.closest('form').getBoundingClientRect().top + window.scrollY - barra - 12;
    window.scrollTo({ top: Math.max(0, y), behavior: reduzirMovimento() ? 'auto' : 'smooth' });
    el.focus({ preventScroll: true });
  }, [titulo]);
}

/** Carrega dados do painel e expõe recarregar(). */
export function useCarregar(buscar, deps) {
  const [estado, setEstado] = useState({ carregando: true, dados: null, erro: null });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const carregar = useCallback(buscar, deps);
  const recarregar = useCallback(async () => {
    setEstado((e) => ({ ...e, carregando: true, erro: null }));
    try {
      setEstado({ carregando: false, dados: await carregar(), erro: null });
    } catch (erro) {
      setEstado((e) => ({ ...e, carregando: false, erro: erro.message }));
    }
  }, [carregar]);
  useEffect(() => {
    recarregar();
  }, [recarregar]);
  return { ...estado, recarregar };
}

/** Mensagem de sucesso/erro de uma ação do painel. */
export function Aviso({ aviso }) {
  if (!aviso) return null;
  return (
    <p className={`alerta${aviso.tipo === 'ok' ? ' alerta--ok' : ''}`} role={aviso.tipo === 'ok' ? 'status' : 'alert'}>
      {aviso.texto}
    </p>
  );
}

export function Carregando({ estado, vazio, children }) {
  if (estado.erro) return <p className="alerta" role="alert">{estado.erro}</p>;
  if (estado.carregando && !estado.dados) return <div className="admin-lista" aria-busy="true"><div className="esqueleto" /><div className="esqueleto" /></div>;
  if (vazio) return <p className="vazio">{vazio}</p>;
  return children;
}

/** "22,50" ou "22" -> 2250 ; inválido -> null */
export function paraCentavos(texto) {
  const limpo = String(texto).trim().replace(/^R\$\s*/, '').replace(/\./g, '').replace(',', '.');
  if (!/^\d+(\.\d{1,2})?$/.test(limpo)) return null;
  return Math.round(Number(limpo) * 100);
}
export const deCentavos = (c) => reais(c).replace(/^R\$\s*/, '');

/** Erros por campo vindos da API (DADOS_INVALIDOS) ou mensagem geral. */
export function tratarErroDeFormulario(erro, setErros, setAviso) {
  const campos = erro.errosDeCampo ?? {};
  if (erro.codigo === 'DADOS_INVALIDOS' && Object.keys(campos).length > 0) {
    setErros(campos);
    setAviso({ tipo: 'erro', texto: 'Confere os campos destacados.' });
  } else {
    setAviso({ tipo: 'erro', texto: erro.message });
  }
}
