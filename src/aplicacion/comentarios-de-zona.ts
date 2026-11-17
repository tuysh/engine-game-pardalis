// Los comentarios del jugador: frases como «¡Qué colorido!» que su personaje dice al entrar
// en una zona del mapa que lleva la propiedad `grupo`. Se elige una frase al azar de ese grupo.
//
// Reglas:
//   - Solo comenta al ENTRAR a la zona, no mientras está dentro.
//   - Cada zona espera su tiempo (`espera`, 20 segundos por defecto) antes de volver a comentar.
//   - Nunca interrumpe un diálogo, y un diálogo que empieza calla el comentario.
//   - El globo de un comentario no atrapa toques: se puede seguir caminando mientras se oye.

import type { Contenido } from '../dominio/contenido.ts';
import { puntoDentroDeForma } from '../dominio/forma.ts';
import type { Punto } from '../dominio/geometria.ts';
import type { Zona } from '../dominio/mundo.ts';
import type { PasoDeLinea } from '../dominio/paso.ts';
import type { Azar } from '../puertos/azar.ts';

/** Lo que los comentarios necesitan para funcionar. */
export interface PiezasDeComentarios {
  readonly contenido: Contenido;
  /** Las zonas del mapa, por nombre. */
  readonly zonas: Readonly<Record<string, Zona>>;
  readonly azar: Azar;
  /**
   * Dice una frase como comentario. La promesa termina cuando el globo se cierra,
   * o antes si `senal` se dispara.
   */
  readonly decirComentario: (linea: PasoDeLinea, senal: AbortSignal) => Promise<void>;
  /** Se llama si decir un comentario falla con un error inesperado. */
  readonly alFallar: (error: unknown) => void;
}

export class ComentariosDeZona {
  private readonly piezas: PiezasDeComentarios;
  /** Los nombres de las zonas donde está el jugador ahora. */
  private readonly zonasOcupadas = new Set<string>();
  /** Cuándo comentó por última vez cada zona, en segundos de juego. */
  private readonly ultimoComentarioEnSegundos = new Map<string, number>();
  private ahoraEnSegundos = 0;
  /** Existe solo mientras se está diciendo un comentario. */
  private cancelador: AbortController | undefined;

  constructor(piezas: PiezasDeComentarios) {
    this.piezas = piezas;
  }

  get hayUnComentario(): boolean {
    return this.cancelador !== undefined;
  }

  /**
   * Se llama en cada cuadro con la posición del jugador.
   * `sePuedeComentar` es `false` mientras hay un diálogo: entonces las zonas se siguen vigilando,
   * pero nadie comenta.
   */
  avanzar(segundos: number, posicionDelJugador: Punto, sePuedeComentar: boolean): void {
    this.ahoraEnSegundos += segundos;

    for (const nombre of Object.keys(this.piezas.zonas)) {
      const zona = this.piezas.zonas[nombre]!; // `nombre` viene de `Object.keys`, así que existe
      const estaDentro = puntoDentroDeForma(posicionDelJugador, zona.forma);
      if (!estaDentro) {
        this.zonasOcupadas.delete(nombre);
        continue;
      }

      const acabaDeEntrar = !this.zonasOcupadas.has(nombre);
      this.zonasOcupadas.add(nombre);
      if (acabaDeEntrar && sePuedeComentar && !this.hayUnComentario) {
        this.comentarSiYaEsperoLoSuficiente(nombre, zona);
      }
    }
  }

  /** Calla el comentario en curso. Si no hay ninguno, no hace nada. */
  callar(): void {
    if (this.cancelador !== undefined) {
      this.cancelador.abort();
    }
  }

  private comentarSiYaEsperoLoSuficiente(nombre: string, zona: Zona): void {
    if (zona.grupo === undefined) return;

    const ultimo = this.ultimoComentarioEnSegundos.get(nombre);
    const yaEsperoLoSuficiente = ultimo === undefined || this.ahoraEnSegundos - ultimo >= zona.esperaEnSegundos;
    if (!yaEsperoLoSuficiente) return;

    const lineas = this.piezas.contenido.comentarios[zona.grupo]!; // la validación garantiza que el grupo existe
    if (lineas.length === 0) return;
    const posicionAlAzar = Math.floor(this.piezas.azar() * lineas.length);
    const linea = lineas[posicionAlAzar]!; // `azar()` es menor que 1, así que la posición es menor que el largo

    this.ultimoComentarioEnSegundos.set(nombre, this.ahoraEnSegundos);
    // No se espera a que termine: el comentario suena mientras el juego sigue.
    void this.decir(linea);
  }

  private async decir(linea: PasoDeLinea): Promise<void> {
    const cancelador = new AbortController();
    this.cancelador = cancelador;
    try {
      await this.piezas.decirComentario(linea, cancelador.signal);
    } catch (error) {
      this.piezas.alFallar(error);
    } finally {
      // Pase lo que pase, se libera: si no, nunca se volvería a comentar.
      if (this.cancelador === cancelador) {
        this.cancelador = undefined;
      }
    }
  }
}
