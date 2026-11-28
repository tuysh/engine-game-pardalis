// Busca con qué voz se dice lo que piden los minijuegos y el host (`contexto.audio.decir` y `juego.decir`):
// la voz grabada de una clave y la voz sintetizada de un personaje (`meta.personajes.<id>.voz`).
//
// Se crea una por nivel. Lo que falta se avisa en la consola **una sola vez por nivel**: un minijuego o el host
// pueden pedir la misma voz sin grabar en cada ronda, y repetir el aviso cada vez llenaba la consola.
// Al cargar otro nivel se crea una nueva y los avisos vuelven a salir.
//
// Las líneas del propio nivel no pasan por aquí: sus voces sin grabar ya las advierte la validación
// al cargar el nivel.

import type { AjustesDeVoz } from '../dominio/ajustes-de-voz.ts';
import type { Personaje } from '../dominio/contenido.ts';

/** Lo que las voces necesitan del nivel. */
export interface PiezasDeLasVoces {
  /** Los personajes del nivel, por id (`meta.personajes`). */
  readonly personajes: Readonly<Record<string, Personaje>>;
  /** La dirección completa de un asset del nivel. `undefined` = el nivel no tiene esa clave. */
  readonly direccionDeAsset: (clave: string) => string | undefined;
}

export class VocesDelNivel {
  private readonly piezas: PiezasDeLasVoces;
  /** Las claves sin voz grabada que ya se avisaron en este nivel. */
  private readonly clavesYaAvisadas = new Set<string>();
  /** Los ids que no son personajes del nivel y que ya se avisaron. */
  private readonly personajesYaAvisados = new Set<string>();

  constructor(piezas: PiezasDeLasVoces) {
    this.piezas = piezas;
  }

  /**
   * La dirección de la voz grabada `clave`. Si el nivel no la tiene, devuelve `undefined` (se usa la voz
   * sintetizada) y lo avisa la primera vez. `llamada` es lo que nombra el aviso, por ejemplo `'juego.decir'`.
   */
  direccionDeVoz(clave: string, llamada: string): string | undefined {
    const direccion = this.piezas.direccionDeAsset(clave);
    if (direccion !== undefined) return direccion;

    if (!this.clavesYaAvisadas.has(clave)) {
      this.clavesYaAvisadas.add(clave);
      console.warn(`[escenario-engine] ${llamada}: "${clave}" no está en los assets del nivel; se usa voz sintetizada`);
    }
    return undefined;
  }

  /**
   * El tono y la velocidad de la voz de un personaje del nivel. `undefined` = la voz normal: el personaje no
   * tiene `voz`, o `quien` no es un personaje del nivel (esto último se avisa la primera vez).
   */
  vozDe(quien: string, llamada: string): AjustesDeVoz | undefined {
    const personajes = this.piezas.personajes;
    // `hasOwn` y no `personajes[quien]`: un id como "constructor" existe en todo objeto de JavaScript.
    if (Object.hasOwn(personajes, quien)) {
      const personaje = personajes[quien]!; // `hasOwn` acaba de comprobar que existe
      return personaje.voz;
    }

    if (!this.personajesYaAvisados.has(quien)) {
      this.personajesYaAvisados.add(quien);
      console.warn(
        `[escenario-engine] ${llamada}: "${quien}" no es un personaje del nivel (meta.personajes); se usa la voz normal`,
      );
    }
    return undefined;
  }
}
