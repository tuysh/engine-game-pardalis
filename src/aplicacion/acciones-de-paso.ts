// Lo que el ejecutor de pasos pide que ocurra en pantalla. El ejecutor (ejecutar-pasos.ts) decide
// QUÉ paso sigue; estas acciones hacen que el paso SE VEA Y SE OIGA.
//
// Cada acción es una promesa que termina cuando la acción terminó (el jugador tocó para seguir,
// el personaje llegó, el minijuego acabó) y que debe terminar también si `senal` se dispara.
//
// Estado: todavía no hay quien las implemente. Cada una se escribe en `aplicacion/` cuando existan
// los puertos que necesita: líneas y opciones con la interfaz y el audio (fase 5), caminar y efectos
// con el escenario (fase 4), minijuegos en la fase 6 (docs/DISENO-3.0.md §13).

import type { Opcion, PasoDeLinea } from '../dominio/paso.ts';
import type { ResultadoDeMinijuego } from '../puertos/minijuego.ts';

export interface AccionesDePaso {
  /** Muestra y dice una línea. `textoCompleto` es el texto con `{faltan}` y `{dinero}` ya reemplazados. */
  decirLinea(linea: PasoDeLinea, textoCompleto: string, senal: AbortSignal): Promise<void>;

  /** Muestra la pregunta con esas opciones y devuelve la posición en la lista de la que eligió el jugador. */
  elegirOpcion(pregunta: string, opciones: readonly Opcion[], senal: AbortSignal): Promise<number>;

  reproducirEfecto(nombre: string, senal: AbortSignal): Promise<void>;

  /** Lleva al personaje caminando hasta un punto del mapa. */
  caminar(personaje: string, punto: string, senal: AbortSignal): Promise<void>;

  /**
   * Abre un minijuego del host y espera su resultado. Si el minijuego falla con un error,
   * debe entregar `{ exito: false }` en vez de rechazar: un error del host nunca castiga al jugador.
   */
  jugarMinijuego(nombre: string, config: unknown, senal: AbortSignal): Promise<ResultadoDeMinijuego>;
}
