// Las poses de una línea: el dibujo que toma quien habla (`con`) y el de quienes escuchan (`reacciona`)
// mientras dura la línea. Al terminar, cada quien vuelve al dibujo que tenía, sin que el nivel lo pida:
// así nadie se queda con la cara de sorpresa puesta el resto del nivel.

import type { PasoDeLinea } from '../dominio/paso.ts';
import type { PiezasDeEscena } from './piezas-de-escena.ts';
import type { DibujoDePersonaje } from './reparto.ts';

/** El dibujo que alguien tenía antes de tomar su pose, para devolvérselo. */
interface DibujoPorDevolver {
  readonly personaje: string;
  readonly dibujo: DibujoDePersonaje;
}

/**
 * Pone las poses de la línea y entrega la función que devuelve a cada quien el dibujo que tenía.
 * No espera a que los dibujos carguen (ya se descargaron al empezar el nivel): así el globo y la voz
 * empiezan de inmediato. Quien no está en el escenario no toma pose.
 */
export function ponerPosesDeLinea(linea: PasoDeLinea, piezas: PiezasDeEscena): () => void {
  const porDevolver: DibujoPorDevolver[] = [];

  for (const pose of reunirPoses(linea)) {
    const dibujoDeAntes = piezas.reparto.dibujoDe(pose.personaje);
    if (dibujoDeAntes === undefined) continue;

    porDevolver.push({ personaje: pose.personaje, dibujo: dibujoDeAntes });
    // Con `repite`, una pose que es animación dura toda la línea y una imagen fija se queda puesta.
    cambiarDibujo(pose.personaje, { imagen: piezas.imagenDeAsset(pose.clave), repite: true }, piezas);
  }

  return () => {
    for (const { personaje, dibujo } of porDevolver) {
      cambiarDibujo(personaje, dibujo, piezas);
    }
  };
}

/** Cambia el dibujo sin esperar. Si el dibujo no carga, la línea sigue igual: solo se avisa en la consola. */
function cambiarDibujo(personaje: string, dibujo: DibujoDePersonaje, piezas: PiezasDeEscena): void {
  piezas.reparto.ponerDibujo(personaje, dibujo.imagen, { repite: dibujo.repite }).catch((error: unknown) => {
    console.warn(`[escenario-engine] no se pudo cambiar el dibujo de "${personaje}" durante una línea:`, error);
  });
}

/** Quién toma qué dibujo en esta línea: primero quien habla y luego quienes escuchan. */
function reunirPoses(linea: PasoDeLinea): { readonly personaje: string; readonly clave: string }[] {
  const poses: { readonly personaje: string; readonly clave: string }[] = [];
  if (linea.pose !== undefined) {
    poses.push({ personaje: linea.hablante, clave: linea.pose });
  }
  if (linea.reacciones !== undefined) {
    for (const personaje of Object.keys(linea.reacciones)) {
      poses.push({ personaje, clave: linea.reacciones[personaje]! }); // `personaje` viene de `Object.keys`
    }
  }
  return poses;
}
