// Minijuego de ejemplo: voltear las tortillas del comal.
// Muestra cómo se escribe un minijuego para el motor: es una función que recibe un elemento de la página
// a pantalla completa, dibuja lo que quiera dentro y devuelve una promesa con el resultado.
//
// Reglas de Pardalis que respeta:
// - Nada requiere leer: se juega tocando dibujos, y cada tortilla dice una palabra en voz alta.
// - Nunca castiga: no se puede perder. El botón de salir solo termina sin éxito, y el nivel responde amable.

import type { Minijuego } from '../src/index.ts';

const TORTILLAS_POR_VOLTEAR = 3;
const PAUSA_ANTES_DE_TERMINAR_EN_MILISEGUNDOS = 900;
const COLOR_DE_TORTILLA_CRUDA = '#f6e3b0';
const COLOR_DE_TORTILLA_LISTA = '#d9a253';

export const Tortilleria: Minijuego = ({ elemento, config, audio, senal }) => {
  return new Promise((terminar) => {
    const palabras = leerPalabras(config);
    let tortillasVolteadas = 0;

    elemento.style.cssText =
      'display:flex; flex-direction:column; align-items:center; justify-content:center; gap:32px; background:#3a2a1a;';

    // El comal: un círculo oscuro con las tortillas encima.
    const comal = document.createElement('div');
    comal.style.cssText =
      'display:flex; gap:24px; padding:48px 56px; border-radius:50%; background:#555; border:10px solid #2b2b2b;';

    for (let i = 0; i < TORTILLAS_POR_VOLTEAR; i++) {
      const tortilla = document.createElement('button');
      tortilla.type = 'button';
      tortilla.setAttribute('aria-label', 'Voltear la tortilla');
      tortilla.style.cssText = `width:110px; height:110px; border-radius:50%; border:6px solid #b98a45; background:${COLOR_DE_TORTILLA_CRUDA}; cursor:pointer;`;

      tortilla.addEventListener(
        'click',
        () => {
          tortilla.style.background = COLOR_DE_TORTILLA_LISTA;
          tortilla.disabled = true;
          tortillasVolteadas++;
          // Cada tortilla dice una de las palabras del nivel, en inglés.
          const palabra = palabras[i % palabras.length];
          if (palabra !== undefined) {
            audio.decir(palabra, 'en');
          }
          if (tortillasVolteadas === TORTILLAS_POR_VOLTEAR) {
            terminarConExito();
          }
        },
        { signal: senal },
      );
      comal.append(tortilla);
    }

    // Salir sin terminar: un botón con una X, que no necesita texto.
    const salir = document.createElement('button');
    salir.type = 'button';
    salir.textContent = '✕';
    salir.setAttribute('aria-label', 'Salir');
    salir.style.cssText =
      'position:absolute; top:16px; right:16px; width:64px; height:64px; border-radius:50%; border:4px solid #2b2b2b; background:#fffdf5; font-size:32px; cursor:pointer;';
    salir.addEventListener('click', () => terminar({ exito: false }), { signal: senal });

    elemento.append(comal, salir);

    function terminarConExito(): void {
      // Una pausa corta para que se vea la última tortilla volteada antes de volver al nivel.
      const temporizador = setTimeout(() => {
        terminar({ exito: true, otorgar: { tortillas: true } });
      }, PAUSA_ANTES_DE_TERMINAR_EN_MILISEGUNDOS);
      // Si el motor cierra el minijuego antes (por ejemplo, al destruir el juego), el temporizador se cancela.
      senal.addEventListener('abort', () => clearTimeout(temporizador), { once: true });
    }
  });
};

/** `config` viene del nivel y puede traer cualquier cosa: se revisa antes de usarla. */
function leerPalabras(config: unknown): string[] {
  const palabras: string[] = [];
  if (typeof config !== 'object' || config === null || !('palabras' in config)) return palabras;
  if (!Array.isArray(config.palabras)) return palabras;

  for (const palabra of config.palabras) {
    if (typeof palabra === 'string') {
      palabras.push(palabra);
    }
  }
  return palabras;
}
