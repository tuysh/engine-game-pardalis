import { expect, test } from 'bun:test';
import { esTeclaDeUnCampo, esTeclaDeUnControl, esTeclaDeUnaVentana } from './tecla-de-un-control.ts';

// Estas pruebas corren sin página: cada paso del camino es un objeto que se parece a un elemento,
// con su etiqueta y sus atributos, como los que entrega `composedPath()` en el navegador.
function elemento(etiqueta: string, atributos: Record<string, string> = {}, esEditable = false) {
  return {
    tagName: etiqueta,
    isContentEditable: esEditable,
    getAttribute: (nombre: string) => atributos[nombre] ?? null,
    hasAttribute: (nombre: string) => Object.hasOwn(atributos, nombre),
  };
}

/** Lo que sigue al elemento con el foco en cualquier camino: el cuerpo, la página y la ventana. */
const FINAL_DEL_CAMINO = [elemento('BODY'), elemento('HTML'), {}, {}];

test('una tecla en el cuerpo de la página es para el juego', () => {
  expect(esTeclaDeUnControl(FINAL_DEL_CAMINO)).toBe(false);
  expect(esTeclaDeUnCampo(FINAL_DEL_CAMINO)).toBe(false);
});

test('Enter en un botón del tablero del host es de ese botón, aunque el foco esté en su dibujo', () => {
  const camino = [elemento('IMG'), elemento('BUTTON', { 'aria-label': 'Mis palabras en inglés' }), ...FINAL_DEL_CAMINO];
  expect(esTeclaDeUnControl(camino)).toBe(true);
  // Un botón no es un campo ni una ventana: las flechas siguen moviendo al jugador y `E` sigue hablando.
  expect(esTeclaDeUnCampo(camino)).toBe(false);
  expect(esTeclaDeUnaVentana(camino)).toBe(false);
});

test('una tarjeta de opciones dentro del «shadow root» del motor cuenta como control', () => {
  // A `window` la tecla llega con el anfitrión como destino; la tarjeta solo aparece en el camino.
  const raizEscondida = {};
  const camino = [elemento('BUTTON', { class: 'tarjeta' }), elemento('DIV'), raizEscondida, elemento('DIV'), ...FINAL_DEL_CAMINO];
  expect(esTeclaDeUnControl(camino)).toBe(true);
});

test('un enlace y algo con rol de botón son controles', () => {
  expect(esTeclaDeUnControl([elemento('A', { href: '#' }), ...FINAL_DEL_CAMINO])).toBe(true);
  expect(esTeclaDeUnControl([elemento('DIV', { role: ' Button ' }), ...FINAL_DEL_CAMINO])).toBe(true);
});

test('dentro de un diálogo del host, como el cuaderno abierto, ninguna tecla de hablar es para el juego', () => {
  for (const ventana of [elemento('DIV', { role: 'dialog' }), elemento('DIALOG')]) {
    const camino = [elemento('DIV'), ventana, ...FINAL_DEL_CAMINO];
    expect(esTeclaDeUnaVentana(camino)).toBe(true);
    expect(esTeclaDeUnControl(camino)).toBe(true);
  }
});

test('lo que está dentro del espacio de un minijuego es del minijuego', () => {
  const camino = [elemento('DIV'), elemento('DIV', { 'data-escenario-minijuego': '' }), ...FINAL_DEL_CAMINO];
  expect(esTeclaDeUnaVentana(camino)).toBe(true);
  expect(esTeclaDeUnControl(camino)).toBe(true);
});

test('un rol que no es de control, como el globo que anuncia lo que se dice, no le quita la tecla al juego', () => {
  expect(esTeclaDeUnControl([elemento('DIV', { role: 'status' }), ...FINAL_DEL_CAMINO])).toBe(false);
});

test('en un campo de texto, una lista de opciones o algo editable ninguna tecla es para el juego', () => {
  for (const campo of [elemento('INPUT'), elemento('TEXTAREA'), elemento('SELECT'), elemento('DIV', {}, true)]) {
    expect(esTeclaDeUnCampo([campo, ...FINAL_DEL_CAMINO])).toBe(true);
    expect(esTeclaDeUnControl([campo, ...FINAL_DEL_CAMINO])).toBe(true);
  }
});
