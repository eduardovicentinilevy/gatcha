import { CONFIG } from '../config.js';

export default function AvisoPrototipo() {
  if (!CONFIG.modoPrototipo) return null;
  return (
    <p className="aviso-prototipo">
      <strong>Protótipo para validação:</strong> dados de exemplo, nenhuma reserva é real.
    </p>
  );
}
