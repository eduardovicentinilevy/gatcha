/**
 * Helpers de DOM. Todo conteúdo dinâmico entra como TEXTO (textContent),
 * nunca como HTML: dados da API ou do usuário não conseguem injetar script (XSS).
 */
export function el(tag, atributos = {}, ...filhos) {
  const no = document.createElement(tag);
  for (const [chave, valor] of Object.entries(atributos)) {
    if (valor == null || valor === false) continue;
    if (chave === 'class') no.className = valor;
    else if (chave === 'dataset') Object.assign(no.dataset, valor);
    else if (chave.startsWith('on') && typeof valor === 'function') no.addEventListener(chave.slice(2), valor);
    else no.setAttribute(chave, valor === true ? '' : String(valor));
  }
  for (const filho of filhos.flat()) {
    if (filho == null || filho === false) continue;
    no.append(filho instanceof Node ? filho : document.createTextNode(String(filho)));
  }
  return no;
}

export const $ = (seletor, raiz = document) => raiz.querySelector(seletor);
export const $$ = (seletor, raiz = document) => [...raiz.querySelectorAll(seletor)];

const formatadorReais = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
export const reais = (centavos) => formatadorReais.format(centavos / 100);

/** Traço do gato-tigela do logo, para avatares sem foto. */
export function desenhoGato() {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '36 50 132 98');
  svg.setAttribute('aria-hidden', 'true');
  for (const d of [
    'M64.6 72.4 72.7 55.8 82.3 71M116 72.6 124.9 58.2 132 77.4',
    'M48.6 71.9C80 64 128 70 154.6 82.3 148 92 100 90 48.6 71.9Z',
    'M48.6 71.9C49 98 52 120 58.2 130.5 72 143 112 146 138.6 126.5 149 112 153 96 154.6 82.3',
    'M89.8 101.6v1.6M106.4 101.6v1.6',
    'M91.5 111c2 4 5 4 6.9 0 1.9 4 4.9 4 6.9 0',
    'M42.1 104.8 72.7 108.8M43.8 118.5 72.7 114.5M48.6 127.3 72.7 120.9M134.6 108.8 161 106.4M134.6 116 162.7 120M132 122.5 158.6 130.5',
  ]) {
    const path = document.createElementNS(ns, 'path');
    path.setAttribute('d', d);
    svg.append(path);
  }
  return svg;
}

/** Limpa erros e marca os campos inválidos de um formulário. */
export function mostrarErrosDeCampo(form, erros) {
  for (const p of $$('[data-erro]', form)) p.textContent = '';
  for (const campo of $$('[aria-invalid]', form)) campo.removeAttribute('aria-invalid');
  let primeiro = null;
  for (const [nome, mensagem] of Object.entries(erros)) {
    const alvo = $(`[data-erro="${CSS.escape(nome)}"]`, form);
    if (alvo) alvo.textContent = mensagem;
    const campo = form.elements.namedItem(nome);
    if (campo instanceof HTMLElement) {
      campo.setAttribute('aria-invalid', 'true');
      if (alvo) {
        alvo.id ||= `erro-${form.id || 'form'}-${nome}`;
        campo.setAttribute('aria-describedby', alvo.id);
      }
      primeiro ??= campo;
    }
  }
  primeiro?.focus();
  return !primeiro;
}
