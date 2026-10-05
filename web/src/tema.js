/**
 * Tema claro/escuro.
 * As cores vêm de CONFIG.cores e viram variáveis CSS (--cor-*) no <html>.
 * Padrão: segue o sistema (prefers-color-scheme). Se a pessoa usar o botão,
 * a escolha fica salva neste navegador (localStorage, só preferência visual).
 */
import { useEffect, useState } from 'react';
import { CONFIG } from './config.js';

const CHAVE = 'gatcha:tema';
const consultaEscuro = window.matchMedia('(prefers-color-scheme: dark)');

const kebab = (s) => s.replace(/[A-Z]/g, (l) => `-${l.toLowerCase()}`);

function lerPreferencia() {
  try {
    const v = localStorage.getItem(CHAVE);
    return v === 'claro' || v === 'escuro' ? v : null;
  } catch {
    return null;
  }
}

function salvarPreferencia(tema) {
  try {
    localStorage.setItem(CHAVE, tema);
  } catch {
    /* modo privado: a escolha vale só nesta visita */
  }
}

export function aplicarTema(tema) {
  const raiz = document.documentElement;
  for (const [nome, valor] of Object.entries(CONFIG.cores[tema])) raiz.style.setProperty(`--cor-${kebab(nome)}`, valor);
  raiz.dataset.tema = tema;
  raiz.style.colorScheme = tema === 'escuro' ? 'dark' : 'light';
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', CONFIG.cores[tema].escuroFixo);
}

export const temaInicial = () => lerPreferencia() ?? (consultaEscuro.matches ? 'escuro' : 'claro');

export function useTema() {
  const [tema, setTema] = useState(temaInicial);

  useEffect(() => aplicarTema(tema), [tema]);

  // Sem escolha manual salva, acompanha mudanças do sistema em tempo real.
  useEffect(() => {
    const aoMudar = (e) => !lerPreferencia() && setTema(e.matches ? 'escuro' : 'claro');
    consultaEscuro.addEventListener('change', aoMudar);
    return () => consultaEscuro.removeEventListener('change', aoMudar);
  }, []);

  const alternar = () =>
    setTema((t) => {
      const novo = t === 'escuro' ? 'claro' : 'escuro';
      salvarPreferencia(novo);
      return novo;
    });

  return [tema, alternar];
}
