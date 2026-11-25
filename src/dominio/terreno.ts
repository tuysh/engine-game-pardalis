// El terreno de un nivel: por dónde se puede caminar y qué estorba, visto desde arriba.
// Se puede pisar un punto si está dentro de algún polígono de piso y fuera de todo obstáculo.

import { puntoDentroDePoligono, puntoDentroDeRectangulo } from './geometria.ts';
import type { Punto, Rectangulo } from './geometria.ts';
import type { Mundo } from './mundo.ts';

export interface Terreno {
  readonly pisos: readonly (readonly Punto[])[];
  /** Las huellas de los objetos que bloquean el paso. */
  readonly obstaculos: readonly Rectangulo[];
}

/** Cuánto se mete hacia adentro un punto ajustado al borde del piso, para que no quede justo en la orilla. */
const MARGEN_DESDE_EL_BORDE_EN_METROS = 0.02;

/** El terreno de un mundo: sus pisos, y como obstáculos las huellas del decorado `parado`. */
export function crearTerreno(mundo: Mundo): Terreno {
  const obstaculos: Rectangulo[] = [];
  for (const objeto of mundo.decorado) {
    if (objeto.clase === 'parado') {
      obstaculos.push(objeto.huella);
    }
  }
  return { pisos: mundo.pisos, obstaculos };
}

export function esCaminable(punto: Punto, terreno: Terreno): boolean {
  const estaSobreElPiso = terreno.pisos.some((piso) => puntoDentroDePoligono(punto, piso));
  if (!estaSobreElPiso) return false;

  const chocaConAlgo = terreno.obstaculos.some((obstaculo) => puntoDentroDeRectangulo(punto, obstaculo));
  return !chocaConAlgo;
}

/**
 * El punto del piso más cercano al que se pide. Sirve cuando el jugador toca fuera del piso:
 * su personaje camina hasta la orilla más cercana. Si el punto ya está sobre el piso, se devuelve igual.
 *
 * No saca el punto de un obstáculo: de eso se encarga la búsqueda de caminos, que lleva a quien camina
 * al lugar pisable más cercano.
 */
export function ajustarAlPiso(punto: Punto, terreno: Terreno): Punto {
  const yaEstaSobreElPiso = terreno.pisos.some((piso) => puntoDentroDePoligono(punto, piso));
  if (yaEstaSobreElPiso) return punto;

  let masCercano: Punto | undefined;
  let menorDistancia = Infinity;
  for (const piso of terreno.pisos) {
    const candidato = puntoMasCercanoDelBorde(punto, piso);
    const distancia = Math.hypot(candidato.x - punto.x, candidato.y - punto.y);
    if (distancia < menorDistancia) {
      menorDistancia = distancia;
      masCercano = meterHaciaAdentro(candidato, piso);
    }
  }

  // Sin pisos no hay a dónde ajustar; la validación garantiza que un nivel tiene al menos uno.
  if (masCercano === undefined) return punto;
  return masCercano;
}

/** Recorre los bordes del polígono y devuelve el punto de ellos más cercano al punto dado. */
function puntoMasCercanoDelBorde(punto: Punto, vertices: readonly Punto[]): Punto {
  let masCercano: Punto = punto;
  let menorDistancia = Infinity;

  for (let i = 0; i < vertices.length; i++) {
    const inicioDelBorde = vertices[i]!; // `i` siempre es menor que el largo de la lista
    const finDelBorde = vertices[(i + 1) % vertices.length]!; // el resto de la división también lo es
    const candidato = puntoMasCercanoDelSegmento(punto, inicioDelBorde, finDelBorde);
    const distancia = Math.hypot(candidato.x - punto.x, candidato.y - punto.y);
    if (distancia < menorDistancia) {
      menorDistancia = distancia;
      masCercano = candidato;
    }
  }
  return masCercano;
}

/**
 * El punto de un segmento más cercano a otro punto.
 * Cómo funciona: se proyecta el punto sobre la línea del segmento y, si la proyección cae fuera
 * del segmento, se toma el extremo más cercano.
 */
function puntoMasCercanoDelSegmento(punto: Punto, inicio: Punto, fin: Punto): Punto {
  const largoEnX = fin.x - inicio.x;
  const largoEnY = fin.y - inicio.y;
  const largoAlCuadrado = largoEnX * largoEnX + largoEnY * largoEnY;
  if (largoAlCuadrado === 0) return inicio;

  // 0 = la proyección cae en el inicio del segmento; 1 = cae en el fin.
  const avanceSinLimitar = ((punto.x - inicio.x) * largoEnX + (punto.y - inicio.y) * largoEnY) / largoAlCuadrado;
  const avance = Math.min(1, Math.max(0, avanceSinLimitar));
  return { x: inicio.x + avance * largoEnX, y: inicio.y + avance * largoEnY };
}

/**
 * Mueve un punto del borde un poquito hacia el centro del polígono, para que quede dentro.
 * Limitación conocida: en un polígono con entrantes muy marcados el centro puede quedar fuera;
 * en ese caso se deja el punto en el borde.
 */
function meterHaciaAdentro(puntoDelBorde: Punto, vertices: readonly Punto[]): Punto {
  let sumaDeX = 0;
  let sumaDeY = 0;
  for (const vertice of vertices) {
    sumaDeX += vertice.x;
    sumaDeY += vertice.y;
  }
  const centro = { x: sumaDeX / vertices.length, y: sumaDeY / vertices.length };

  const distanciaAlCentro = Math.hypot(centro.x - puntoDelBorde.x, centro.y - puntoDelBorde.y);
  if (distanciaAlCentro === 0) return puntoDelBorde;

  const proporcion = MARGEN_DESDE_EL_BORDE_EN_METROS / distanciaAlCentro;
  const movido = {
    x: puntoDelBorde.x + (centro.x - puntoDelBorde.x) * proporcion,
    y: puntoDelBorde.y + (centro.y - puntoDelBorde.y) * proporcion,
  };
  if (!puntoDentroDePoligono(movido, vertices)) return puntoDelBorde;
  return movido;
}
