import { test } from 'node:test';
import assert from 'node:assert/strict';
import { celulasDoDia, mapearOcupacao, montarGrade, vagasLivres } from '../../src/modules/reservas/disponibilidade.js';

const h = (hhmm) => {
  const [a, b] = hhmm.split(':').map(Number);
  return a * 60 + b;
};
const JANELAS = [
  { inicio: h('10:00'), fim: h('11:00') },
  { inicio: h('14:00'), fim: h('15:00') },
];
const CAPACIDADE = 6;

const vagas = (inicio, duracao, reservas = [], bloqueios = []) =>
  vagasLivres({
    inicio: h(inicio),
    duracao,
    janelas: JANELAS,
    ocupacao: mapearOcupacao(JANELAS, reservas, bloqueios),
    capacidade: CAPACIDADE,
  });

test('gera células de 15 min apenas dentro das janelas', () => {
  assert.deepEqual(celulasDoDia(JANELAS), [600, 615, 630, 645, 840, 855, 870, 885]);
});

test('agenda vazia: capacidade total', () => {
  assert.deepEqual(vagas('10:00', 15), { vagas: 6, motivo: null });
  assert.deepEqual(vagas('10:00', 30), { vagas: 6, motivo: null });
});

test('reserva de 30 min ocupa as duas células', () => {
  const reservas = [{ inicio: h('10:00'), fim: h('10:30'), pessoas: 4 }];
  assert.equal(vagas('10:00', 15, reservas).vagas, 2);
  assert.equal(vagas('10:15', 15, reservas).vagas, 2);
  assert.equal(vagas('10:30', 15, reservas).vagas, 6);
  // 30 min começando 10:15 cruza 10:15 (2 livres) e 10:30 (6 livres) -> mínimo = 2
  assert.equal(vagas('10:15', 30, reservas).vagas, 2);
});

test('soma reservas sobrepostas e nunca devolve vaga negativa', () => {
  const reservas = [
    { inicio: h('10:00'), fim: h('10:15'), pessoas: 4 },
    { inicio: h('10:00'), fim: h('10:30'), pessoas: 4 }, // capacidade reduzida depois
  ];
  assert.equal(vagas('10:00', 15, reservas).vagas, 0);
});

test('intervalo não pode atravessar a pausa entre janelas nem passar do fim', () => {
  assert.deepEqual(vagas('10:45', 30), { vagas: 0, motivo: 'FORA_DA_JANELA' });
  assert.deepEqual(vagas('12:00', 15), { vagas: 0, motivo: 'FORA_DA_JANELA' });
  assert.deepEqual(vagas('10:45', 15), { vagas: 6, motivo: null });
});

test('bloqueio zera as vagas de qualquer intervalo que o toque', () => {
  const bloqueios = [{ inicio: h('14:15'), fim: h('14:30') }];
  assert.deepEqual(vagas('14:15', 15, [], bloqueios), { vagas: 0, motivo: 'BLOQUEADO' });
  assert.deepEqual(vagas('14:00', 30, [], bloqueios), { vagas: 0, motivo: 'BLOQUEADO' });
  assert.equal(vagas('14:00', 15, [], bloqueios).vagas, 6);
  assert.equal(vagas('14:30', 30, [], bloqueios).vagas, 6);
});

test('montarGrade omite horários que já começaram', () => {
  const grade = montarGrade({ janelas: JANELAS, capacidade: CAPACIDADE, reservas: [], bloqueios: [], aposMinuto: h('10:30') });
  assert.deepEqual(
    grade.map((g) => g.hora_inicio),
    ['10:45', '14:00', '14:15', '14:30', '14:45'],
  );
  assert.deepEqual(grade[0], { hora_inicio: '10:45', vagas_15min: 6, vagas_30min: 0 });
});
