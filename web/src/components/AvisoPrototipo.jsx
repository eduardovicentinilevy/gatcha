import { CONFIG } from '../config.js';

export default function AvisoPrototipo() {
  if (!CONFIG.modoPrototipo) return null;
  return (
    <aside className="aviso-prototipo" aria-label="Aviso do protótipo">
      <strong>Protótipo para validação:</strong> dados de exemplo, nenhuma reserva é real.
    </aside>
  );
}
