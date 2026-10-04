import { test } from 'node:test';
import assert from 'node:assert/strict';
import { agoraNoFuso, diaDaSemana, formatarHora, isDataValida, parseHora, somarDias } from '../../src/lib/tempo.js';

test('parseHora / formatarHora fazem ida e volta', () => {
  assert.equal(parseHora('00:00'), 0);
  assert.equal(parseHora('14:30'), 870);
  assert.equal(formatarHora(870), '14:30');
  assert.equal(parseHora('24:00'), null);
  assert.equal(parseHora('9:00'), null);
  assert.equal(parseHora("10:00' OR 1=1"), null);
});

test('isDataValida rejeita datas inexistentes e formatos inválidos', () => {
  assert.equal(isDataValida('2026-10-05'), true);
  assert.equal(isDataValida('2028-02-29'), true);
  assert.equal(isDataValida('2026-02-29'), false);
  assert.equal(isDataValida('2026-13-01'), false);
  assert.equal(isDataValida('05/10/2026'), false);
});

test('somarDias atravessa mês e ano', () => {
  assert.equal(somarDias('2026-10-31', 1), '2026-11-01');
  assert.equal(somarDias('2026-12-25', 14), '2027-01-08');
});

test('diaDaSemana: 0 = domingo', () => {
  assert.equal(diaDaSemana('2026-10-04'), 0); // domingo
  assert.equal(diaDaSemana('2026-10-10'), 6); // sábado
});

test('agoraNoFuso converte UTC para o horário de São Paulo', () => {
  // 02:30 UTC de 05/10 = 23:30 de 04/10 em São Paulo (UTC-3)
  assert.deepEqual(agoraNoFuso('America/Sao_Paulo', new Date('2026-10-05T02:30:00Z')), {
    data: '2026-10-04',
    minutos: 23 * 60 + 30,
  });
});
