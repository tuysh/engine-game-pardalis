// Hace que se oigan y se vean los pasos `musica`, `sonido` y `video`.
// Cada uno nombra un asset por su clave; aquí se busca su archivo y se le pide al puerto que lo reproduzca.

import type { Idioma } from '../dominio/idioma.ts';
import type { PiezasDeDireccion } from './piezas-de-direccion.ts';
import type { PiezasDeEscena } from './piezas-de-escena.ts';

/** Cambia la música de fondo. Si la clave no tiene archivo, sigue sonando la que había. */
export function ponerMusicaEnEscena(clave: string, escena: PiezasDeEscena): void {
  // Una música que no está en los assets ya se advirtió al validar.
  const direccion = escena.direccionDeAsset(clave);
  if (direccion !== undefined) {
    escena.audio.ponerMusica(direccion);
  }
}

/** Toca un sonido corto, sin esperar a que termine. Si la clave no tiene archivo, no suena. */
export function tocarSonidoEnEscena(clave: string, escena: PiezasDeEscena): void {
  // Un sonido que no está en los assets ya se advirtió al validar.
  const direccion = escena.direccionDeAsset(clave);
  if (direccion !== undefined) {
    escena.audio.tocar(direccion);
  }
}

/**
 * Reproduce el video del idioma del sitio. Termina cuando el video acaba o cuando `senal` se dispara.
 * Si el video no existe o no se puede reproducir, avisa en la consola y termina: la escena sigue sin él.
 */
export async function reproducirVideoEnEscena(
  clavePorIdioma: Readonly<Record<Idioma, string>>,
  senal: AbortSignal,
  piezas: PiezasDeDireccion,
): Promise<void> {
  const clave = clavePorIdioma[piezas.escena.idiomaBase];
  const direccion = piezas.escena.direccionDeAsset(clave);
  if (direccion === undefined) {
    // La validación garantiza que el video de un nivel existe; esto solo le pasa a una cinemática en código.
    console.warn(`[escenario-engine] no existe el video "${clave}" en los assets del nivel; la escena sigue sin él`);
    return;
  }

  const resultado = await piezas.video.reproducir(direccion, senal);
  if (resultado === 'no_se_pudo') {
    console.warn(`[escenario-engine] no se pudo reproducir el video "${clave}"; la escena sigue sin él`);
  }
}
