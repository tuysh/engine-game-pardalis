// Monta en el escenario lo que se ve de un nivel: la escenografía y los personajes que están desde el principio.
// También descarga por adelantado las imágenes que las escenas usarán después y, si se pidió, avisa del avance.

import type { Escenario } from '../puertos/escenario.ts';
import { avisarDeLaCarga } from './avisar-de-la-carga.ts';
import type { PedidoDeJuego } from './nivel-en-juego.ts';
import { prepararEscenografia, prepararImagenesDeEscenas, prepararPersonajes } from './preparar-escena.ts';
import { Reparto } from './reparto.ts';

/** La promesa termina cuando todo cargó, con el reparto de los personajes que ya están en el escenario. */
export async function montarNivel(pedido: PedidoDeJuego, escenario: Escenario): Promise<Reparto> {
  const { nivel, ubicacion } = pedido;
  const escenografia = prepararEscenografia(nivel, ubicacion);
  const personajes = prepararPersonajes(nivel, ubicacion);
  const imagenesDeEscenas = prepararImagenesDeEscenas(nivel, ubicacion);

  let dejarDeAvisarDeLaCarga = (): void => {};
  if (pedido.alCargar !== undefined) {
    const imagenes = { escenografia, personajes, imagenesDeEscenas };
    dejarDeAvisarDeLaCarga = avisarDeLaCarga(imagenes, escenario, pedido.alCargar);
  }

  const reparto = new Reparto(escenario);
  try {
    await escenario.montar(escenografia);
    // Así el escenario sabe a quién no debe tapar el decorado que queda cerca de la cámara.
    escenario.marcarJugador(nivel.contenido.jugador?.personaje);
    // Todas las imágenes de personajes se piden a la vez, para que la carga dure lo que dura la más lenta.
    await Promise.all(personajes.map((personaje) => reparto.agregar(personaje)));
    // Lo que las escenas usarán más tarde se descarga desde ahora, para que aparezca sin demora cuando le toque.
    await escenario.precargar(imagenesDeEscenas);
  } finally {
    dejarDeAvisarDeLaCarga();
  }
  return reparto;
}
