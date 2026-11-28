// Los comentarios del jugador: frases como «¡Qué colorido!» que su personaje dice al entrar
// en una zona del mapa que lleva la propiedad `grupo`. Se elige una frase al azar de ese grupo.
//
// Reglas:
//   - Solo comenta al ENTRAR a la zona, no mientras está dentro.
//   - Cada zona espera su tiempo (`espera`, 20 segundos por defecto) antes de volver a comentar.
//   - Nunca interrumpe un diálogo, y un diálogo que empieza calla el comentario.
//   - El globo de un comentario no atrapa toques: se puede seguir caminando mientras se oye.
//   - Avisa cuándo empieza y cuándo termina cada comentario, con el nombre de su zona. Al callarlo, el fin
//     se avisa en ese mismo momento: así, cuando un diálogo calla un comentario, el host recibe el fin
//     del comentario antes que el inicio del diálogo, y nunca se le enciman.

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
  /** Se llama justo antes de decir un comentario, con el nombre de su zona. */
  readonly alEmpezarComentario?: (zona: string) => void;
  /** Se llama una sola vez cuando ese comentario termina o se calla, con el nombre de su zona. */
  readonly alTerminarComentario?: (zona: string) => void;
}

/** El comentario que se está diciendo. */
interface ComentarioEnCurso {
  readonly zona: string;
  readonly cancelador: AbortController;
}

export class ComentariosDeZona {
  private readonly piezas: PiezasDeComentarios;
  /** Los nombres de las zonas donde está el jugador ahora. */
  private readonly zonasOcupadas = new Set<string>();
  /** Cuándo comentó por última vez cada zona, en segundos de juego. */
  private readonly ultimoComentarioEnSegundos = new Map<string, number>();
  private ahoraEnSegundos = 0;
  /** Existe solo mientras se está diciendo un comentario. */
  private enCurso: ComentarioEnCurso | undefined;

  constructor(piezas: PiezasDeComentarios) {
    this.piezas = piezas;
  }

  get hayUnComentario(): boolean {
    return this.enCurso !== undefined;
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
    const enCurso = this.enCurso;
    if (enCurso === undefined) return;
    enCurso.cancelador.abort();
    this.terminar(enCurso);
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
    void this.decir(linea, nombre);
  }

  private async decir(linea: PasoDeLinea, zona: string): Promise<void> {
    const enCurso: ComentarioEnCurso = { zona, cancelador: new AbortController() };
    this.enCurso = enCurso;
    try {
      if (this.piezas.alEmpezarComentario !== undefined) {
        this.piezas.alEmpezarComentario(zona);
      }
      await this.piezas.decirComentario(linea, enCurso.cancelador.signal);
    } catch (error) {
      this.piezas.alFallar(error);
    } finally {
      // Pase lo que pase, se libera: si no, nunca se volvería a comentar.
      this.terminar(enCurso);
    }
  }

  /** Libera el comentario y avisa que terminó. Si ya se liberó (porque se calló), no hace nada. */
  private terminar(enCurso: ComentarioEnCurso): void {
    if (this.enCurso !== enCurso) return;
    this.enCurso = undefined;
    if (this.piezas.alTerminarComentario !== undefined) {
      this.piezas.alTerminarComentario(enCurso.zona);
    }
  }
}
