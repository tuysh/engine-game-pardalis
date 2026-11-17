// Donde la validación de un nivel va anotando lo que encuentra.
//
// - Un error significa que el nivel no puede arrancar.
// - Una advertencia significa que funciona, pero hay algo que revisar.

export interface Diagnostico {
  readonly errores: string[];
  readonly advertencias: string[];
}

export function crearDiagnostico(): Diagnostico {
  return { errores: [], advertencias: [] };
}
