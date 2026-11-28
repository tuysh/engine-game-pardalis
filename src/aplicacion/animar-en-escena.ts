// Hace que un paso `anima` se vea: cambia el dibujo de un personaje, o de un objeto del decorado con id,
// por una animación o por otra imagen.
//
//   - Con `repite`, se queda con el dibujo nuevo (la animación vuelve a empezar al terminar)
//     y el paso acaba de inmediato. Sirve también para dejarlo en una pose: una imagen fija con `repite`.
//   - Sin `repite`, la animación pasa una vez, el paso espera a que termine y vuelve a su dibujo normal:
//     el `sprite` de `meta.personajes` para un personaje, el `asset` del mapa para un objeto.
//
// Si el id es de un personaje, se anima al personaje; solo si ningún personaje se llama así, al objeto.

import type { PasoDeAnimacion } from '../dominio/paso.ts';
import type { ImagenDeEscena } from '../puertos/escenario.ts';
import type { PiezasDeDireccion } from './piezas-de-direccion.ts';

export async function animarEnEscena(
  paso: PasoDeAnimacion,
  senal: AbortSignal,
  piezas: PiezasDeDireccion,
): Promise<void> {
  const contenido = piezas.escena.contenido;
  if (Object.hasOwn(contenido.meta.personajes, paso.personaje)) {
    await animarPersonaje(paso, senal, piezas);
    return;
  }
  await animarObjeto(paso, senal, piezas);
}

async function animarPersonaje(paso: PasoDeAnimacion, senal: AbortSignal, piezas: PiezasDeDireccion): Promise<void> {
  const { reparto, reloj, contenido } = piezas.escena;
  if (!reparto.estaEnEscena(paso.personaje)) return;

  const animacion = piezas.escena.imagenDeAsset(paso.clave);
  await reparto.ponerDibujo(paso.personaje, animacion, { repite: paso.repite });
  if (paso.repite) return;

  await reloj.esperar(calcularDuracionEnSegundos(animacion), senal);
  const personaje = contenido.meta.personajes[paso.personaje]!; // se comprobó con `hasOwn` antes de llamar
  await reparto.ponerDibujo(paso.personaje, piezas.escena.imagenDeAsset(personaje.sprite), { repite: true });
}

async function animarObjeto(paso: PasoDeAnimacion, senal: AbortSignal, piezas: PiezasDeDireccion): Promise<void> {
  const { escenario, reloj, imagenDeAsset } = piezas.escena;
  const decorado = piezas.escena.decorado ?? [];
  const indice = decorado.findIndex((objeto) => objeto.id === paso.personaje);
  // La validación garantiza que el objeto existe; una cinemática en código podría nombrar otro, y no pasa nada.
  if (indice < 0) return;

  const animacion = imagenDeAsset(paso.clave);
  await escenario.ponerDibujoDeDecorado(indice, animacion, { repite: paso.repite });
  if (paso.repite) return;

  await reloj.esperar(calcularDuracionEnSegundos(animacion), senal);
  const dibujoNormal = imagenDeAsset(decorado[indice]!.asset); // `indice` salió de `findIndex` sobre la misma lista
  // Un objeto del decorado que es una animación la repite siempre (una bandera, un foco).
  await escenario.ponerDibujoDeDecorado(indice, dibujoNormal, { repite: true });
}

/** Lo que tarda una animación en pasar una vez. Una imagen fija no dura nada. */
function calcularDuracionEnSegundos(animacion: ImagenDeEscena): number {
  if (animacion.cuadrosPorSegundo <= 0) return 0;
  return animacion.direcciones.length / animacion.cuadrosPorSegundo;
}
