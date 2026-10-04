import { $, $$ } from './dom.js';
import { iniciarCardapio } from './cardapio.js';
import { iniciarReserva, renderPrecos } from './reserva.js';
import { iniciarAdocao } from './adocao.js';

function iniciarMenu() {
  const botao = $('.menu-botao');
  const menu = $('#menu-principal');
  const definir = (aberto) => {
    menu.classList.toggle('aberto', aberto);
    botao.setAttribute('aria-expanded', String(aberto));
    $('.sr', botao).textContent = aberto ? 'Fechar menu' : 'Abrir menu';
  };
  botao.addEventListener('click', () => definir(!menu.classList.contains('aberto')));
  for (const link of $$('a', menu)) link.addEventListener('click', () => definir(false));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && menu.classList.contains('aberto')) {
      definir(false);
      botao.focus();
    }
  });
}

iniciarMenu();
renderPrecos($('[data-precos]'));
iniciarReserva($('[data-reserva]'));
iniciarCardapio($('#cardapio'));
iniciarAdocao($('#adocao'));
