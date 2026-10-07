-- As reservas do gatil continuam no balcão (decisão do Gatchá): o site não faz mais reservas.
-- Apaga as tabelas de reservas e bloqueios e, com elas, qualquer dado pessoal de reserva (LGPD).
-- O histórico do código fica no Git, caso a reserva online volte um dia.
DROP TABLE IF EXISTS reservas;
DROP TABLE IF EXISTS bloqueios;
