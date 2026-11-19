// Hace que un paso `anima` se vea: cambia el dibujo de un personaje por una animación o por otra imagen.
//
//   - Con `repite`, el personaje se queda con el dibujo nuevo (la animación vuelve a empezar al terminar)
//     y el paso acaba de inmediato. Sirve también para dejarlo en una pose: una imagen fija con `repite`.
//   - Sin `repite`, la animación pasa una vez, el paso espera a que termine y el personaje vuelve a su
//     dibujo normal (el `sprite` de `meta.personajes`).

import type { PasoDeAnimacion } from '../dominio/paso.ts';
import type { ImagenDeEscena } from '../puertos/escenario.ts';
import type { PiezasDeDireccion } from './piezas-de-direccion.ts';

export async function animarEnEscena(
  paso: PasoDeAnimacion,
  senal: AbortSignal,
  piezas: PiezasDeDireccion,
): Promise<void> {
  const { reparto, reloj, contenido } = piezas.escena;
  if (!reparto.estaEnEscena(paso.personaje)) return;

  const animacion = piezas.imagenDeAsset(paso.clave);
  await reparto.ponerDibujo(paso.personaje, animacion, { repite: paso.repite });
  if (paso.repite) return;

  await reloj.esperar(calcularDuracionEnSegundos(animacion), senal);
  const personaje = contenido.meta.personajes[paso.personaje]!; // la validación garantiza que el personaje existe
  await reparto.ponerDibujo(paso.personaje, piezas.imagenDeAsset(personaje.sprite), { repite: true });
}

/** Lo que tarda una animación en pasar una vez. Una imagen fija no dura nada. */
function calcularDuracionEnSegundos(animacion: ImagenDeEscena): number {
  if (animacion.cuadrosPorSegundo <= 0) return 0;
  return animacion.direcciones.length / animacion.cuadrosPorSegundo;
}
