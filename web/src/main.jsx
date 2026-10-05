import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
// Fontes servidas pelo próprio site (sem Google Fonts): mais rápido, sem rastreamento e compatível com a CSP.
import '@fontsource-variable/bricolage-grotesque';
import '@fontsource-variable/nunito';
import { aplicarTema, temaInicial } from './tema.js';
import App from './App.jsx';
import './estilo.css';

aplicarTema(temaInicial()); // antes do primeiro render: evita "piscar" o tema errado

createRoot(document.getElementById('raiz')).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
