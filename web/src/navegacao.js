/**
 * Navegação entre as páginas do site (início ↔ painel) sem recarregar,
 * com transição animada.
 *
 * - Usa a View Transitions API (Chrome/Edge/Safari): a página nova se revela num
 *   círculo que cresce a partir do ponto clicado (CSS em estilo.css).
 * - Navegadores sem a API (ex.: Firefox): a página nova entra com um fade.
 * - prefers-reduced-motion: troca instantânea, sem animação.
 * - Links de âncora na MESMA página (#cardapio, #gatil…) seguem o comportamento
 *   normal do navegador (rolagem suave). Links externos, target="_blank" e
 *   cliques com Ctrl/Cmd/Shift também não são interceptados.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { reduzirMovimento } from './util.js';

const TITULOS = {
  inicio: 'Gatchá · Cat café de matchá na República',
  admin: 'Painel · Gatchá',
};

const CAMINHOS = { '/admin': 'admin' };
export const paginaDoCaminho = (caminho) => CAMINHOS[caminho.replace(/\/+$/, '')] ?? 'inicio';

const suportaTransicao = () => typeof document.startViewTransition === 'function';

/**
 * Mantém a âncora no lugar enquanto o conteúdo acima dela termina de carregar
 * (cardápio, destaques…), que empurraria a seção para baixo. Desiste se a
 * pessoa rolar por conta própria ou depois de 2 segundos.
 */
function fixarAncora(alvo) {
  const rolar = () => alvo.scrollIntoView({ block: 'start', behavior: 'instant' });
  rolar();
  const observador = new ResizeObserver(rolar);
  observador.observe(document.body);
  const parar = () => {
    observador.disconnect();
    for (const ev of ['wheel', 'touchstart', 'keydown']) window.removeEventListener(ev, parar);
  };
  for (const ev of ['wheel', 'touchstart', 'keydown']) window.addEventListener(ev, parar, { passive: true, once: true });
  setTimeout(parar, 2000);
}

/** Depois da troca: rola para a âncora (ou para o topo), atualiza o título e leva o foco ao conteúdo. */
function aposTrocar(pagina, hash) {
  document.title = TITULOS[pagina];
  const alvo = hash ? document.getElementById(decodeURIComponent(hash.slice(1))) : null;
  if (alvo) {
    fixarAncora(alvo);
    return;
  }
  window.scrollTo({ top: 0, behavior: 'instant' });
  const principal = document.getElementById('conteudo');
  if (principal) {
    principal.setAttribute('tabindex', '-1');
    principal.focus({ preventScroll: true });
  }
}

export function usePagina() {
  const [pagina, setPagina] = useState(() => paginaDoCaminho(window.location.pathname));
  const paginaAtual = useRef(pagina); // lida nos listeners sem recriá-los
  const [semApi, setSemApi] = useState(false); // ativa o fade alternativo (sem View Transitions) no próximo render

  const trocar = useCallback((nova, hash, origem) => {
    const raiz = document.documentElement;
    raiz.style.setProperty('--vt-x', origem ? `${origem.x}px` : '50%');
    raiz.style.setProperty('--vt-y', origem ? `${origem.y}px` : '30%');

    paginaAtual.current = nova;
    const atualizar = () => {
      flushSync(() => setPagina(nova));
      aposTrocar(nova, hash);
    };

    if (reduzirMovimento()) return atualizar();
    if (suportaTransicao()) {
      document.startViewTransition(atualizar);
    } else {
      setSemApi(true);
      atualizar();
    }
  }, []);

  // Intercepta cliques em links internos que levam a OUTRA página do site.
  useEffect(() => {
    const aoClicar = (e) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const link = e.target.closest?.('a[href]');
      if (!link || link.target === '_blank' || link.hasAttribute('download')) return;
      const url = new URL(link.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      const nova = paginaDoCaminho(url.pathname);
      if (nova === paginaDoCaminho(window.location.pathname)) return; // âncora na mesma página: deixa o navegador rolar

      e.preventDefault();
      window.history.pushState({}, '', url.pathname + url.hash);
      trocar(nova, url.hash, { x: e.clientX, y: e.clientY });
    };
    // Voltar/avançar do navegador também anima. Atenção: clicar numa âncora da
    // MESMA página (#cardapio) também dispara popstate; aí não há o que animar.
    const aoVoltar = () => {
      const nova = paginaDoCaminho(window.location.pathname);
      if (nova === paginaAtual.current) return;
      trocar(nova, window.location.hash, null);
    };
    document.addEventListener('click', aoClicar);
    window.addEventListener('popstate', aoVoltar);
    document.title = TITULOS[paginaDoCaminho(window.location.pathname)];
    return () => {
      document.removeEventListener('click', aoClicar);
      window.removeEventListener('popstate', aoVoltar);
    };
  }, [trocar]);

  return { pagina, animarSemApi: semApi };
}
