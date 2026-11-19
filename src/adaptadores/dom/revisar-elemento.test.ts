import { expect, test } from 'bun:test';
import { revisarDondeMontar, revisarElemento } from './revisar-elemento.ts';

test('`null` no sirve: es lo que da un selector que no encontró nada, y el mensaje dice qué se esperaba', () => {
  expect(revisarElemento(null)).toBe(
    'elemento: el primer argumento de crearEscenario() debe ser un elemento de la página, ' +
      `por ejemplo document.querySelector('#juego'); llegó null`,
  );
});

test('un texto con el selector tampoco sirve: hay que entregar el elemento', () => {
  expect(revisarElemento('#juego')).toEndWith('llegó "#juego"');
});

test('un elemento de la página se reconoce por su marca de elemento', () => {
  expect(revisarElemento({ nodeType: 1 })).toBeUndefined();
});

test('sin navegador no hay dónde montar el juego, y el mensaje dice cómo llamarlo solo en el navegador', () => {
  // Estas pruebas corren sin página, igual que un sitio que se arma en el servidor.
  expect(revisarDondeMontar({ nodeType: 1 })).toBe(
    'crearEscenario() necesita un navegador y aquí no hay página. Si el sitio también se arma en el servidor, ' +
      'llámalo solo en el navegador (por ejemplo, dentro de onMount o de un <script>)',
  );
});
