// Los efectos del paso `efecto`: `magia` (un estallido de chispas) y `confeti` (papelitos que caen).
// Cada efecto es una nube de puntitos de colores que se mueve sola durante un momento y luego se quita.
//
// El azar de aquí es solo de apariencia (hacia dónde sale cada chispa), por eso usa `Math.random`
// y no el azar del juego.

import { BufferAttribute, BufferGeometry, Color, Points, PointsMaterial } from 'three';

/** Un punto del espacio 3D de Three.js. */
interface LugarEnElEspacio {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

/** Cómo es un efecto: cuántas partículas, cuánto dura, de qué colores y cómo nace cada partícula. */
interface RecetaDeEfecto {
  readonly cantidadDeParticulas: number;
  readonly duracionEnSegundos: number;
  readonly tamanoDeParticulaEnMetros: number;
  readonly colores: readonly number[];
  /** Cuánto cambia la velocidad vertical cada segundo. Negativo = las partículas van cayendo. */
  readonly gravedadEnMetrosPorSegundoAlCuadrado: number;
  /** Dónde nace una partícula y con qué velocidad, a partir del centro del efecto. */
  readonly crearParticula: (centro: LugarEnElEspacio) => { posicion: LugarEnElEspacio; velocidad: LugarEnElEspacio };
}

const RECETAS: Readonly<Record<string, RecetaDeEfecto>> = {
  // Chispas que salen del centro hacia todos lados y se apagan.
  magia: {
    cantidadDeParticulas: 40,
    duracionEnSegundos: 0.9,
    tamanoDeParticulaEnMetros: 0.22,
    colores: [0xffe066, 0xff8ad8, 0x8ae2ff],
    gravedadEnMetrosPorSegundoAlCuadrado: -1.5,
    crearParticula(centro) {
      const rapidez = alAzarEntre(0.8, 2.6);
      const giro = alAzarEntre(0, Math.PI * 2);
      const inclinacion = alAzarEntre(-Math.PI / 2, Math.PI / 2);
      return {
        posicion: centro,
        velocidad: {
          x: Math.cos(giro) * Math.cos(inclinacion) * rapidez,
          y: Math.sin(inclinacion) * rapidez,
          z: Math.sin(giro) * Math.cos(inclinacion) * rapidez,
        },
      };
    },
  },
  // Papelitos que caen desde arriba, repartidos a lo ancho de lo que se ve.
  confeti: {
    cantidadDeParticulas: 90,
    duracionEnSegundos: 1.6,
    tamanoDeParticulaEnMetros: 0.24,
    colores: [0xe2572b, 0x3fa34d, 0x2f6fd0, 0xf2c230, 0xef7fb0],
    gravedadEnMetrosPorSegundoAlCuadrado: 0,
    crearParticula(centro) {
      return {
        posicion: {
          x: centro.x + alAzarEntre(-6, 6),
          y: alAzarEntre(3.5, 5.5),
          z: centro.z + alAzarEntre(-1.5, 1.5),
        },
        velocidad: { x: alAzarEntre(-0.6, 0.6), y: alAzarEntre(-3, -1.2), z: 0 },
      };
    },
  },
};

/** Los efectos se dibujan después de todo lo demás, para que se vean encima. */
const ORDEN_DE_LOS_EFECTOS = 10;

const COORDENADAS_POR_PARTICULA = 3;

export class EfectoDeParticulas {
  /** La nube de puntos. Quien crea el efecto la agrega a la escena y la quita cuando termina. */
  readonly puntos: Points;
  private readonly receta: RecetaDeEfecto;
  /** La velocidad de cada partícula: tres números seguidos (x, y, z) por partícula. */
  private readonly velocidades: Float32Array;
  private edadEnSegundos = 0;

  private constructor(receta: RecetaDeEfecto, centro: LugarEnElEspacio) {
    this.receta = receta;
    const posiciones = new Float32Array(receta.cantidadDeParticulas * COORDENADAS_POR_PARTICULA);
    const colores = new Float32Array(receta.cantidadDeParticulas * COORDENADAS_POR_PARTICULA);
    this.velocidades = new Float32Array(receta.cantidadDeParticulas * COORDENADAS_POR_PARTICULA);

    for (let i = 0; i < receta.cantidadDeParticulas; i++) {
      const particula = receta.crearParticula(centro);
      const posicionDelColor = Math.floor(Math.random() * receta.colores.length);
      const color = new Color(receta.colores[posicionDelColor]!); // la posición es menor que el largo de la lista
      const inicio = i * COORDENADAS_POR_PARTICULA;

      posiciones.set([particula.posicion.x, particula.posicion.y, particula.posicion.z], inicio);
      this.velocidades.set([particula.velocidad.x, particula.velocidad.y, particula.velocidad.z], inicio);
      colores.set([color.r, color.g, color.b], inicio);
    }

    const geometria = new BufferGeometry();
    geometria.setAttribute('position', new BufferAttribute(posiciones, COORDENADAS_POR_PARTICULA));
    geometria.setAttribute('color', new BufferAttribute(colores, COORDENADAS_POR_PARTICULA));
    const material = new PointsMaterial({
      size: receta.tamanoDeParticulaEnMetros,
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      // Un efecto es un adorno de la escena completa: se ve aunque haya algo delante.
      depthTest: false,
    });
    this.puntos = new Points(geometria, material);
    this.puntos.renderOrder = ORDEN_DE_LOS_EFECTOS;
    // Las partículas se mueven lejos de donde nacieron; sin esto, Three.js podría dejar de dibujarlas.
    this.puntos.frustumCulled = false;
  }

  /** Crea el efecto de ese nombre, o `undefined` si no existe (la validación de niveles lo impide). */
  static crear(nombre: string, centro: LugarEnElEspacio): EfectoDeParticulas | undefined {
    if (!Object.hasOwn(RECETAS, nombre)) return undefined;
    return new EfectoDeParticulas(RECETAS[nombre]!, centro); // `hasOwn` acaba de comprobar que existe
  }

  /** Mueve las partículas lo que corresponde a un cuadro. Devuelve `false` cuando el efecto ya terminó. */
  actualizar(segundos: number): boolean {
    this.edadEnSegundos += segundos;
    const posiciones = this.puntos.geometry.getAttribute('position');

    for (let i = 0; i < this.receta.cantidadDeParticulas; i++) {
      // Las tres posiciones existen: el arreglo de velocidades se creó con tres números por partícula.
      const lugarDeY = i * COORDENADAS_POR_PARTICULA + 1;
      this.velocidades[lugarDeY]! += this.receta.gravedadEnMetrosPorSegundoAlCuadrado * segundos;

      posiciones.setXYZ(
        i,
        posiciones.getX(i) + this.velocidades[lugarDeY - 1]! * segundos,
        posiciones.getY(i) + this.velocidades[lugarDeY]! * segundos,
        posiciones.getZ(i) + this.velocidades[lugarDeY + 1]! * segundos,
      );
    }
    posiciones.needsUpdate = true;

    // Las partículas se van transparentando: despacio al principio y rápido al final.
    const parteDeLaVida = Math.min(1, this.edadEnSegundos / this.receta.duracionEnSegundos);
    const material = this.puntos.material;
    if (material instanceof PointsMaterial) {
      material.opacity = 1 - parteDeLaVida * parteDeLaVida;
    }
    return this.edadEnSegundos < this.receta.duracionEnSegundos;
  }

  /** Libera la memoria de video del efecto. */
  liberar(): void {
    this.puntos.geometry.dispose();
    const material = this.puntos.material;
    if (material instanceof PointsMaterial) {
      material.dispose();
    }
  }
}

function alAzarEntre(minimo: number, maximo: number): number {
  return minimo + Math.random() * (maximo - minimo);
}
