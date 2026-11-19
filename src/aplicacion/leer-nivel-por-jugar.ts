// Lee y valida el nivel que se va a jugar. Al nivel se le nombra por su id en `niveles`
// (los niveles que registró el host) o, si no está ahí, directamente por la dirección de su `nivel.json`.

import { ErrorDeEscenario } from '../dominio/error-de-escenario.ts';
import type { Nivel } from '../dominio/nivel.ts';
import type { ResultadoDeValidacion } from './validar-nivel.ts';

/** Un nivel ya leído y validado, listo para ponerse a jugar. */
export interface NivelPorJugar {
  /** Con qué id se le conoce: el de `niveles` si está registrado; si no, el `meta.id` de su contenido. */
  readonly id: string;
  /** La dirección de su `nivel.json`: sus assets se buscan junto a ella. */
  readonly direccion: string;
  readonly nivel: Nivel;
}

/** De dónde salen los niveles. */
export interface FuenteDeNiveles {
  /** Id de nivel → dirección de su `nivel.json`. */
  readonly niveles: Readonly<Record<string, string>>;
  /** Lee y valida un nivel por la dirección de su `nivel.json`. */
  readonly leerNivel: (direccionDelNivel: string) => Promise<ResultadoDeValidacion>;
}

/**
 * Las advertencias del nivel van a la consola. Si el nivel tiene errores, rechaza con un
 * `ErrorDeEscenario` que los trae todos.
 */
export async function leerNivelPorJugar(nombre: string, fuente: FuenteDeNiveles): Promise<NivelPorJugar> {
  const estaRegistrado = Object.hasOwn(fuente.niveles, nombre);
  let direccion = nombre;
  if (estaRegistrado) {
    direccion = fuente.niveles[nombre]!; // `hasOwn` acaba de comprobar que existe
  }

  const resultado = await fuente.leerNivel(direccion);
  for (const advertencia of resultado.advertencias) {
    console.warn(`[escenario-engine] ${advertencia}`);
  }
  if (resultado.nivel === undefined) {
    throw new ErrorDeEscenario(resultado.errores);
  }

  let id = resultado.nivel.contenido.meta.id;
  if (estaRegistrado) {
    id = nombre;
  }
  return { id, direccion, nivel: resultado.nivel };
}
