// Dice si una tecla va para un control de la página (un botón, un enlace, un campo de texto, un diálogo
// del host o un minijuego) en vez de para el juego.
//
// Enter y la barra espaciadora oprimen el botón que tiene el foco: así funcionan con teclado los botones
// del tablero del host, los de los minijuegos y las tarjetas de un paso `elige`. Si el motor las usara
// además para hablar o para seguir el diálogo, cancelaría ese botón (con `preventDefault`) y empezaría
// una plática que nadie pidió.
//
// Se recorre el camino completo del evento (`composedPath`) y no solo su destino: una tecla oprimida en
// un botón dentro de un «shadow root», como las tarjetas del motor, llega a `window` con el anfitrión como
// destino, y el botón solo aparece en el camino.
//
// No usa `instanceof HTMLElement` a propósito: así se puede probar sin navegador, con objetos que se
// parecen a un elemento (igual que `revisar-elemento.ts`).

/** Etiquetas de los campos donde se escribe o se elige con las flechas: ahí ninguna tecla es para el juego. */
const ETIQUETAS_DE_CAMPOS: readonly string[] = ['INPUT', 'TEXTAREA', 'SELECT'];

/** Etiquetas de lo que Enter o la barra espaciadora oprimen. */
const ETIQUETAS_DE_CONTROLES: readonly string[] = ['BUTTON', 'A', 'SUMMARY'];

/** Roles de ARIA que hacen las veces de un botón, un enlace o una casilla. */
const ROLES_DE_CONTROLES: readonly string[] = ['button', 'link', 'checkbox', 'radio', 'switch', 'tab', 'menuitem', 'option'];

/** Roles de ARIA de una ventana del host que tapa el juego, como un cuaderno abierto. */
const ROLES_DE_VENTANAS: readonly string[] = ['dialog', 'alertdialog'];

/** El atributo con que el motor marca el espacio de un minijuego (`abrirEspacioDeMinijuego`). */
const ATRIBUTO_DEL_ESPACIO_DE_MINIJUEGO = 'data-escenario-minijuego';

/** Lo poco que se lee de cada paso del camino. Un elemento de la página lo cumple; `window` o `document`, no. */
interface ParecidoAUnElemento {
  readonly tagName: string;
  readonly isContentEditable?: boolean;
  getAttribute(nombre: string): string | null;
  hasAttribute(nombre: string): boolean;
}

/**
 * `true` si la tecla se oprimió en un campo de texto o de opciones (input, textarea, select o algo
 * editable). Ahí ni siquiera las flechas son para el juego: mueven el cursor o cambian la opción.
 */
export function esTeclaDeUnCampo(camino: readonly unknown[]): boolean {
  return camino.some((paso) => {
    if (!pareceUnElemento(paso)) return false;
    return paso.isContentEditable === true || ETIQUETAS_DE_CAMPOS.includes(paso.tagName.toUpperCase());
  });
}

/**
 * `true` si la tecla se oprimió dentro de una ventana que tapa el juego: un diálogo del host (`<dialog>` o
 * `role="dialog"`) o el espacio de un minijuego. Ahí ni siquiera `E` pide hablar con quien está detrás.
 */
export function esTeclaDeUnaVentana(camino: readonly unknown[]): boolean {
  return camino.some((paso) => {
    if (!pareceUnElemento(paso)) return false;
    if (paso.tagName.toUpperCase() === 'DIALOG') return true;
    if (paso.hasAttribute(ATRIBUTO_DEL_ESPACIO_DE_MINIJUEGO)) return true;
    return tieneUnRolDe(paso, ROLES_DE_VENTANAS);
  });
}

/**
 * `true` si la tecla se oprimió en un control del host o del motor: un campo, un botón, un enlace,
 * algo con rol de botón, o cualquier cosa dentro de una ventana (ver `esTeclaDeUnaVentana`).
 * Enter y la barra espaciadora son entonces de ese control: ni piden hablar ni siguen el diálogo.
 */
export function esTeclaDeUnControl(camino: readonly unknown[]): boolean {
  if (esTeclaDeUnCampo(camino) || esTeclaDeUnaVentana(camino)) return true;
  return camino.some((paso) => {
    if (!pareceUnElemento(paso)) return false;
    if (ETIQUETAS_DE_CONTROLES.includes(paso.tagName.toUpperCase())) return true;
    return tieneUnRolDe(paso, ROLES_DE_CONTROLES);
  });
}

function tieneUnRolDe(elemento: ParecidoAUnElemento, roles: readonly string[]): boolean {
  const rol = elemento.getAttribute('role');
  return rol !== null && roles.includes(rol.trim().toLowerCase());
}

function pareceUnElemento(paso: unknown): paso is ParecidoAUnElemento {
  if (typeof paso !== 'object' || paso === null) return false;
  const posible = paso as Partial<Record<keyof ParecidoAUnElemento, unknown>>; // se revisa cada campo abajo
  return (
    typeof posible.tagName === 'string' &&
    typeof posible.getAttribute === 'function' &&
    typeof posible.hasAttribute === 'function'
  );
}
