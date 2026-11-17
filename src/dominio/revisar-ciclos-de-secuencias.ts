// Detecta secuencias que se llaman en círculo (a llama a b, y b vuelve a llamar a a).
// Un ciclo así nunca terminaría al jugar, por eso es un error de validación.

import type { Diagnostico } from './diagnostico.ts';
import type { Paso, PasosOSecuencia } from './paso.ts';

type Secuencias = Readonly<Record<string, readonly Paso[]>>;

export function revisarCiclosDeSecuencias(secuencias: Secuencias, diagnostico: Diagnostico): void {
  const yaRevisadas = new Set<string>();

  for (const nombre of Object.keys(secuencias)) {
    seguirLlamadas(nombre, [], { secuencias, yaRevisadas, diagnostico });
  }
}

interface Busqueda {
  readonly secuencias: Secuencias;
  /** Secuencias cuyas llamadas ya se siguieron por completo: no hace falta volver a entrar. */
  readonly yaRevisadas: Set<string>;
  readonly diagnostico: Diagnostico;
}

/**
 * Sigue las llamadas que salen de una secuencia.
 * `camino` son las secuencias por las que se llegó hasta aquí; si `nombre` ya está en él, hay un ciclo.
 */
function seguirLlamadas(nombre: string, camino: readonly string[], busqueda: Busqueda): void {
  if (camino.includes(nombre)) {
    const cicloCompleto = [...camino, nombre].join(' → ');
    busqueda.diagnostico.errores.push(`ciclo entre secuencias: ${cicloCompleto}`);
    return;
  }
  if (busqueda.yaRevisadas.has(nombre)) return;
  // Una secuencia que no existe ya se reporta en revisar-enlaces.ts; aquí no hay nada que seguir.
  if (!Object.hasOwn(busqueda.secuencias, nombre)) return;

  const pasos = busqueda.secuencias[nombre]!; // `hasOwn` acaba de comprobar que existe
  const caminoHastaAqui = [...camino, nombre];
  for (const llamada of secuenciasQueLlama(pasos)) {
    seguirLlamadas(llamada, caminoHastaAqui, busqueda);
  }
  busqueda.yaRevisadas.add(nombre);
}

/** Los nombres de las secuencias que una lista de pasos llama, incluidos los pasos de adentro. */
function secuenciasQueLlama(pasos: readonly Paso[]): string[] {
  const nombres: string[] = [];

  for (const paso of pasos) {
    switch (paso.tipo) {
      case 'secuencia':
        nombres.push(paso.nombre);
        break;
      case 'condicional':
      case 'juntos':
        nombres.push(...secuenciasQueLlama(paso.pasos));
        break;
      case 'elige':
        for (const opcion of paso.opciones) {
          nombres.push(...secuenciasQueLlamaUnLugar(opcion.alElegir));
        }
        break;
      case 'linea':
      case 'efecto':
      case 'pon':
      case 'juego':
      case 'camina':
      case 'espera':
      case 'camara':
      case 'mira':
      case 'anima':
      case 'aparece':
      case 'desaparece':
      case 'musica':
      case 'sonido':
      case 'fundido':
      case 'video':
      case 'sale':
        break; // estos pasos no llaman secuencias
    }
  }
  return nombres;
}

function secuenciasQueLlamaUnLugar(valor: PasosOSecuencia): string[] {
  switch (valor.tipo) {
    case 'secuencia':
      return [valor.nombre];
    case 'pasos':
      return secuenciasQueLlama(valor.pasos);
  }
}
