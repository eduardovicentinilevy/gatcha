/** Ícones em SVG inline (sem biblioteca). Decorativos por padrão: quem usa dá o rótulo ao botão. */
const base = { width: 24, height: 24, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true, focusable: false };

export const IconeSol = (p) => (
  <svg {...base} {...p}><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>
);
export const IconeLua = (p) => (
  <svg {...base} {...p}><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" /></svg>
);
export const IconeMenu = (p) => <svg {...base} {...p}><path d="M4 7h16M4 12h16M4 17h16" /></svg>;
export const IconeFechar = (p) => <svg {...base} {...p}><path d="M6 6l12 12M18 6 6 18" /></svg>;
export const IconeSetaEsq = (p) => <svg {...base} {...p}><path d="M15 18l-6-6 6-6" /></svg>;
export const IconeSetaDir = (p) => <svg {...base} {...p}><path d="M9 18l6-6-6-6" /></svg>;
export const IconeBusca = (p) => <svg {...base} {...p}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>;
export const IconeCheck = (p) => <svg {...base} {...p}><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>;
export const IconeMapa = (p) => <svg {...base} {...p}><path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21Z" /><circle cx="12" cy="9.5" r="2.5" /></svg>;
export const IconeRelogio = (p) => <svg {...base} {...p}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>;
export const IconeMetro = (p) => <svg {...base} {...p}><rect x="5" y="3" width="14" height="14" rx="3" /><path d="M5 11h14M9 21l-2-4M15 21l2-4M8.5 14h.01M15.5 14h.01" /></svg>;
export const IconeChat = (p) => <svg {...base} {...p}><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12Z" /><path d="M8.5 12h.01M12 12h.01M15.5 12h.01" /></svg>;
export const IconeInstagram = (p) => <svg {...base} {...p}><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><path d="M17.5 6.5h.01" /></svg>;
export const IconeWhatsapp = (p) => (
  <svg {...base} {...p}><path d="M3.5 20.5l1.3-4.2A8.5 8.5 0 1 1 8 19.5Z" /><path d="M9 8.5c0 3.5 3 6.5 6.5 6.5l1-1.6-2-1-1 1c-1.2-.5-2.4-1.7-2.9-2.9l1-1-1-2-1.6 1Z" /></svg>
);
export const IconeEstrela = (p) => (
  <svg {...base} fill="currentColor" stroke="none" {...p}><path d="M12 3.2l2.7 5.6 6.1.8-4.5 4.2 1.1 6-5.4-2.9-5.4 2.9 1.1-6L3.2 9.6l6.1-.8Z" /></svg>
);

/** Patinha (detalhe temático). */
export const IconePatinha = (p) => (
  <svg viewBox="0 0 24 24" width={24} height={24} fill="currentColor" aria-hidden focusable={false} {...p}>
    <ellipse cx="6.5" cy="9" rx="2" ry="2.6" /><ellipse cx="10" cy="5.6" rx="2" ry="2.6" /><ellipse cx="14" cy="5.6" rx="2" ry="2.6" />
    <ellipse cx="17.5" cy="9" rx="2" ry="2.6" /><path d="M12 10.5c-3 0-6 3.6-6 6.2 0 2 1.6 2.8 3.2 2.8 1.2 0 1.8-.6 2.8-.6s1.6.6 2.8.6c1.6 0 3.2-.8 3.2-2.8 0-2.6-3-6.2-6-6.2Z" />
  </svg>
);

/** Xícara de matchá (detalhe temático). */
export const IconeXicara = (p) => (
  <svg {...base} {...p}><path d="M4 9h13v4a6 6 0 0 1-6 6h-1a6 6 0 0 1-6-6Z" /><path d="M17 10.5h1.5a2.5 2.5 0 0 1 0 5H16.5M8 3.5c0 1 1 1 1 2s-1 1-1 2M12 3.5c0 1 1 1 1 2s-1 1-1 2M5 21h12" /></svg>
);
