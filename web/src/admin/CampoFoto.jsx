import { useId, useRef, useState } from 'react';
import { enviarImagem } from './api.js';

const ACEITOS = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_LADO_ENVIO = 2400; // o servidor reduz para 1600; aqui só evitamos subir 10 MB pelo 4G

/**
 * Foto de celular costuma ter 4 a 12 MB: reduz no próprio navegador antes de enviar.
 * (O servidor reprocessa tudo de novo; isto é só para o envio ser rápido.)
 */
async function prepararArquivo(arquivo) {
  if (!ACEITOS.includes(arquivo.type)) throw new Error('Envie uma foto JPG, PNG ou WebP.');
  if (arquivo.size <= 2 * 1024 * 1024) return arquivo;
  let bitmap;
  try {
    bitmap = await createImageBitmap(arquivo, { imageOrientation: 'from-image' });
  } catch {
    throw new Error('Não deu pra abrir essa foto. Tente um JPG ou PNG.');
  }
  const escala = Math.min(1, MAX_LADO_ENVIO / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * escala);
  canvas.height = Math.round(bitmap.height * escala);
  canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close?.();
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Não deu pra preparar a foto.'))), 'image/jpeg', 0.9));
}

/** Campo de foto do painel: enviar, trocar, remover ou colar um link. */
export default function CampoFoto({ id, valor, onChange, erro }) {
  const entrada = useRef(null);
  const idDica = useId();
  const [estado, setEstado] = useState({ enviando: false, erro: null });

  async function escolher(e) {
    const arquivo = e.target.files?.[0];
    e.target.value = ''; // permite escolher o mesmo arquivo de novo
    if (!arquivo) return;
    setEstado({ enviando: true, erro: null });
    try {
      const imagem = await enviarImagem(await prepararArquivo(arquivo));
      onChange(imagem.url);
      setEstado({ enviando: false, erro: null });
    } catch (falha) {
      setEstado({ enviando: false, erro: falha.message });
    }
  }

  const mensagemErro = estado.erro ?? erro;
  return (
    <div className="campo campo--largo admin-foto">
      <span className="admin-foto__rotulo">Foto <span className="opcional">(opcional)</span></span>
      <div className="admin-foto__linha">
        <div className="admin-foto__previa" aria-busy={estado.enviando || undefined}>
          {estado.enviando ? <span>Enviando…</span> : valor ? <img src={valor} alt="Prévia da foto" /> : <span>Sem foto</span>}
        </div>
        <div className="admin-foto__acoes">
          <div className="admin-foto__botoes">
            <button type="button" className="botao botao--pequeno" onClick={() => entrada.current.click()} disabled={estado.enviando} aria-describedby={idDica}>
              {valor ? 'Trocar foto' : 'Enviar foto'}
            </button>
            {valor && !estado.enviando && (
              <button type="button" className="botao botao--pequeno botao--secundario" onClick={() => onChange('')}>Remover</button>
            )}
          </div>
          <p id={idDica} className="campo__dica">JPG, PNG ou WebP, direto do celular. A foto é otimizada automaticamente.</p>
          <input ref={entrada} type="file" accept={ACEITOS.join(',')} hidden onChange={escolher} />
        </div>
      </div>
      {mensagemErro && <p className="campo__erro" role="alert">{mensagemErro}</p>}
      <details className="admin-foto__link">
        <summary>Ou usar um link</summary>
        <label htmlFor={id} className="sr">Link da foto</label>
        <input id={id} value={valor} onChange={(e) => onChange(e.target.value)} placeholder="https://… ou /img/gatos/matcha.jpg" />
      </details>
    </div>
  );
}
