// La demo del motor: carga el nivel de ejemplo "barrio" dentro de la página.
// Se abre con `bun ejemplo/servidor.ts`. Es también un ejemplo de cómo usa el paquete un host sin framework.

import { crearEscenario } from '../src/index.ts';
import type { Minijuego } from '../src/index.ts';

/**
 * Minijuego provisional: termina de inmediato con éxito y entrega las tortillas.
 * El motor todavía no abre minijuegos; hace falta registrarlo para que el nivel pase la validación.
 */
const Tortilleria: Minijuego = async () => {
  return { exito: true, otorgar: { tortillas: true } };
};

const elemento = document.querySelector<HTMLElement>('#juego');
const aviso = document.querySelector<HTMLElement>('#aviso');
if (elemento === null || aviso === null) {
  throw new Error('a la página de la demo le falta el elemento #juego o #aviso');
}

try {
  const juego = await crearEscenario(elemento, {
    niveles: { barrio: '/niveles/barrio/nivel.json' },
    nivel: 'barrio',
    minijuegos: { Tortilleria },
  });
  addEventListener('pagehide', () => juego.destruir());
} catch (error) {
  // Un nivel mal escrito se explica en la propia página: cada problema en su línea.
  const problemas = error instanceof Error && 'problemas' in error ? error.problemas : undefined;
  aviso.hidden = false;
  aviso.textContent = Array.isArray(problemas) ? problemas.join('\n') : String(error);
  console.error(error);
}
