// Hace que se vean los pasos que meten, sacan y voltean personajes: `aparece`, `desaparece` y `mira`.

import type { Punto } from '../dominio/geometria.ts';
import type { PasoDeAparicion, PasoDeMirada } from '../dominio/paso.ts';
import type { PiezasDeDireccion } from './piezas-de-direccion.ts';

/**
 * Mete a un personaje al escenario, parado en un punto del mapa. Termina cuando su imagen ya cargó.
 * Si el personaje ya estaba en el escenario, solo lo pasa a ese punto.
 */
export async function aparecerEnEscena(paso: PasoDeAparicion, piezas: PiezasDeDireccion): Promise<void> {
  const { reparto, contenido, puntos } = piezas.escena;
  const posicion = puntos[paso.punto]!; // la validación garantiza que el punto existe

  if (reparto.estaEnEscena(paso.personaje)) {
    reparto.mover(paso.personaje, posicion);
    return;
  }

  const personaje = contenido.meta.personajes[paso.personaje]!; // la validación garantiza que el personaje existe
  await reparto.agregar({
    id: paso.personaje,
    imagen: piezas.escena.imagenDeAsset(personaje.sprite),
    posicion,
    mira: 'derecha',
    // Igual que los personajes del mapa: se le puede hablar solo si tiene diálogo en el contenido.
    sePuedeTocar: Object.hasOwn(contenido.npcs, paso.personaje),
  });
}

/** Voltea a un personaje hacia otro personaje o hacia un punto del mapa. */
export function mirarEnEscena(paso: PasoDeMirada, piezas: PiezasDeDireccion): void {
  const haciaDonde = buscarLugar(paso.hacia, piezas);
  if (haciaDonde !== undefined) {
    piezas.escena.reparto.mirarHacia(paso.personaje, haciaDonde);
  }
}

/** Dónde está un personaje o un punto del mapa, por su nombre. `undefined` si el personaje no está en escena. */
function buscarLugar(nombre: string, piezas: PiezasDeDireccion): Punto | undefined {
  const { reparto, contenido, puntos } = piezas.escena;
  if (Object.hasOwn(contenido.meta.personajes, nombre)) {
    return reparto.posicionDe(nombre);
  }
  if (Object.hasOwn(puntos, nombre)) {
    return puntos[nombre];
  }
  return undefined;
}
