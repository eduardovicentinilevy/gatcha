import { test } from 'node:test';
import assert from 'node:assert/strict';
import { configurarAmbienteDeTeste } from '../helpers/ambiente.js';

configurarAmbienteDeTeste();
const { criarReservaBody, consultarHorariosQuery } = await import('../../src/modules/reservas/reservas.schemas.js');
const { gerarCodigoReserva, RE_CODIGO_RESERVA } = await import('../../src/lib/codigo-reserva.js');

const valido = {
  data: '2026-10-10',
  hora_inicio: '14:30',
  duracao_min: 30,
  pessoas: 2,
  nome: '  Ana   Júlia  D\'Ávila ',
  telefone: '+55 (11) 91234-5678',
  email: ' Ana.Julia@Exemplo.COM ',
};

test('normaliza entrada válida', () => {
  const r = criarReservaBody.parse(valido);
  assert.equal(r.nome, "Ana Júlia D'Ávila");
  assert.equal(r.telefone, '11912345678');
  assert.equal(r.email, 'ana.julia@exemplo.com');
});

test('rejeita campos extras (mass assignment)', () => {
  const r = criarReservaBody.safeParse({ ...valido, status: 'compareceu', codigo: 'GATCHA-AAAAAA' });
  assert.equal(r.success, false);
});

test('rejeita payloads de XSS/SQLi no nome', () => {
  for (const nome of ['<script>alert(1)</script>', "Robert'); DROP TABLE reservas;--", 'a'.repeat(101)]) {
    assert.equal(criarReservaBody.safeParse({ ...valido, nome }).success, false, nome);
  }
});

test('rejeita tipos e limites inválidos', () => {
  const casos = [
    { duracao_min: 45 },
    { duracao_min: '30' },
    { pessoas: 0 },
    { pessoas: 5 }, // RESERVA_MAX_PESSOAS = 4 no teste
    { pessoas: 2.5 },
    { hora_inicio: '14:10' },
    { hora_inicio: '24:00' },
    { data: '2026-02-30' },
    { telefone: '1234' },
    { email: 'nao-e-email' },
  ];
  for (const caso of casos) {
    assert.equal(criarReservaBody.safeParse({ ...valido, ...caso }).success, false, JSON.stringify(caso));
  }
});

test('query de horários aceita só uma data válida', () => {
  assert.equal(consultarHorariosQuery.safeParse({ data: '2026-10-10' }).success, true);
  assert.equal(consultarHorariosQuery.safeParse({ data: ['2026-10-10', '2026-10-11'] }).success, false);
  assert.equal(consultarHorariosQuery.safeParse({ data: "2026-10-10' OR '1'='1" }).success, false);
  assert.equal(consultarHorariosQuery.safeParse({}).success, false);
});

test('código de reserva tem formato e alfabeto esperados', () => {
  const codigos = new Set(Array.from({ length: 1000 }, gerarCodigoReserva));
  assert.equal(codigos.size, 1000);
  for (const c of codigos) assert.match(c, RE_CODIGO_RESERVA);
});
