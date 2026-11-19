// Revisa que el juego se pueda montar donde el host pidió: que haya una página y que lo que entregó
// sea de verdad un elemento de ella. Lo más común es que llegue `null`: es lo que devuelve
// `document.querySelector` cuando no encuentra nada.

import { describirValor } from '../../dominio/describir-valor.ts';

/** El número con que el navegador marca a un elemento (y no a un texto o a un comentario de la página). */
const TIPO_DE_NODO_ELEMENTO = 1;

/** Por qué el juego no se puede montar en `elemento`, o `undefined` si sí se puede. */
export function revisarDondeMontar(elemento: unknown): string | undefined {
  // Sin `document` no hay página: pasa cuando el sitio se arma primero en el servidor.
  if (typeof document === 'undefined') {
    return (
      'crearEscenario() necesita un navegador y aquí no hay página. Si el sitio también se arma en el servidor, ' +
      'llámalo solo en el navegador (por ejemplo, dentro de onMount o de un <script>)'
    );
  }
  return revisarElemento(elemento);
}

/** Por qué `elemento` no sirve para alojar el juego, o `undefined` si sí sirve. */
export function revisarElemento(elemento: unknown): string | undefined {
  // Se reconoce por su marca y no con `instanceof`: así sirve también un elemento de otra ventana.
  const esUnElemento =
    typeof elemento === 'object' &&
    elemento !== null &&
    'nodeType' in elemento &&
    elemento.nodeType === TIPO_DE_NODO_ELEMENTO;
  if (esUnElemento) return undefined;

  return (
    'elemento: el primer argumento de crearEscenario() debe ser un elemento de la página, ' +
    `por ejemplo document.querySelector('#juego'); llegó ${describirValor(elemento)}`
  );
}
