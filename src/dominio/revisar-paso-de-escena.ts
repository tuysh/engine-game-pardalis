// Revisa los pasos de escena (los que mueven personajes y cámara): que exista lo que nombran dentro del contenido.
// Lo que nombran del mapa (puntos) y de los assets (animaciones, sonidos, videos) se revisa aparte,
// al cruzar el contenido con el mapa y con los assets.

import { CAMARA_AL_JUGADOR } from './paso.ts';
import type { Paso, PasoDeCamara } from './paso.ts';
import type { Revision } from './revision.ts';

export function revisarPasoDeEscena(paso: Paso, ruta: string, revision: Revision): void {
  switch (paso.tipo) {
    case 'mira':
    case 'anima':
    case 'aparece':
    case 'desaparece':
      revisarPersonaje(paso.personaje, ruta, revision);
      break;

    case 'camara':
      revisarDestinoDeCamara(paso, ruta, revision);
      break;

    default:
      break; // los demás pasos no son de escena, o no nombran nada del contenido
  }
}

function revisarPersonaje(personaje: string, ruta: string, revision: Revision): void {
  if (!Object.hasOwn(revision.contenido.meta.personajes, personaje)) {
    revision.diagnostico.errores.push(`${ruta}: el personaje "${personaje}" no existe en meta.personajes`);
  }
}

/** La cámara va a un plano con nombre, a un personaje, o vuelve al jugador. */
function revisarDestinoDeCamara(paso: PasoDeCamara, ruta: string, revision: Revision): void {
  const contenido = revision.contenido;

  if (paso.destino === CAMARA_AL_JUGADOR) {
    if (contenido.jugador === undefined) {
      revision.diagnostico.errores.push(`${ruta}: "camara": "jugador" no se puede usar: el nivel no tiene jugador`);
    }
    return;
  }

  const esUnPlano = Object.hasOwn(contenido.mundo.planos, paso.destino);
  const esUnPersonaje = Object.hasOwn(contenido.meta.personajes, paso.destino);
  if (!esUnPlano && !esUnPersonaje) {
    revision.diagnostico.errores.push(
      `${ruta}: "camara": "${paso.destino}" no es un plano de mundo.planos, ni un personaje, ni "jugador"`,
    );
  }
}
