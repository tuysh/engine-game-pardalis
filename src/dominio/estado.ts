// El estado de un nivel: las variables que cambian mientras se juega
// (qué objetos tiene el jugador, con quién habló, qué objetivos cumplió).
//
// El estado nunca se modifica: cada cambio devuelve un estado nuevo. Así se puede comparar
// el de antes con el de después (por ejemplo, para saber qué objetivos se acaban de cumplir).

/** Lo que puede guardar una variable del estado. */
export type ValorDeEstado = boolean | number | string;

/** Las variables de un nivel, por nombre. Ejemplo: `{ tortillas: true, 'charlas.tortu': true }`. */
export type VariablesDeEstado = Readonly<Record<string, ValorDeEstado>>;

/** Nombre de la variable que guarda el dinero del jugador. Existe solo si el nivel declara `estado.dinero`. */
export const NOMBRE_DEL_DINERO = 'dinero';

/** Lo que un nivel declara en su sección `estado`. */
export interface DeclaracionDeEstado {
  /** Lo que hay que conseguir para terminar el nivel. Ejemplo: `['tortillas', 'aguacates']`. */
  readonly objetivos: readonly string[];
  /** Otras variables que el nivel usa en sus condiciones y pasos `pon`. */
  readonly variables: readonly string[];
  /** Cómo nombrar cada objetivo con su artículo: `{ tortillas: 'las tortillas' }`. */
  readonly lista: Readonly<Record<string, string>>;
  /** Dinero con el que empieza el jugador. `undefined` = el nivel no usa dinero. */
  readonly dinero?: number;
}

/** El estado de un nivel en un momento dado. */
export interface EstadoDeNivel {
  readonly declaracion: DeclaracionDeEstado;
  readonly variables: VariablesDeEstado;
}

/** Vista de solo lectura del estado. Es lo que reciben los minijuegos. */
export interface LectorDeEstado {
  /** Valor de una variable, o `undefined` si nunca se le dio valor. */
  obtener(nombre: string): ValorDeEstado | undefined;
  /** Dice si se cumple una condición escrita como en los niveles. Ejemplo: `'no tengo tortillas'`. */
  cumple(condicion: string): boolean;
}

/** Crea el estado con el que empieza un nivel, o con el que continúa si hay variables guardadas. */
export function crearEstadoDeNivel(
  declaracion: DeclaracionDeEstado,
  variablesGuardadas: VariablesDeEstado = {},
): EstadoDeNivel {
  const variables: Record<string, ValorDeEstado> = {};
  if (declaracion.dinero !== undefined) {
    variables[NOMBRE_DEL_DINERO] = declaracion.dinero;
  }
  copiarVariables(variablesGuardadas, variables);
  return { declaracion, variables };
}

/** Devuelve un estado nuevo con los cambios aplicados. El estado recibido no cambia. */
export function conCambios(estado: EstadoDeNivel, cambios: VariablesDeEstado): EstadoDeNivel {
  const variables: Record<string, ValorDeEstado> = {};
  copiarVariables(estado.variables, variables);
  copiarVariables(cambios, variables);
  return { declaracion: estado.declaracion, variables };
}

/** Valor de una variable, o `undefined` si nunca se le dio valor. */
export function valorDe(estado: EstadoDeNivel, nombre: string): ValorDeEstado | undefined {
  // `hasOwn` y no `variables[nombre]`: un nombre como "constructor" existe en todo objeto de JavaScript.
  if (!Object.hasOwn(estado.variables, nombre)) return undefined;
  return estado.variables[nombre];
}

/** Dice si una variable tiene un valor verdadero (ni `false`, ni `0`, ni texto vacío). */
export function tieneValor(estado: EstadoDeNivel, nombre: string): boolean {
  return Boolean(valorDe(estado, nombre));
}

/** Dice si ya se cumplieron todos los objetivos del nivel. Un nivel sin objetivos siempre los tiene completos. */
export function estanCompletosLosObjetivos(estado: EstadoDeNivel): boolean {
  return objetivosQueFaltan(estado).length === 0;
}

/** Los objetivos que todavía no se cumplen, en el orden en que el nivel los declara. */
export function objetivosQueFaltan(estado: EstadoDeNivel): string[] {
  const pendientes: string[] = [];
  for (const objetivo of estado.declaracion.objetivos) {
    if (!tieneValor(estado, objetivo)) {
      pendientes.push(objetivo);
    }
  }
  return pendientes;
}

/** Los objetivos que no estaban cumplidos en `antes` y sí lo están en `despues`. */
export function objetivosRecienCumplidos(antes: EstadoDeNivel, despues: EstadoDeNivel): string[] {
  const recienCumplidos: string[] = [];
  for (const objetivo of despues.declaracion.objetivos) {
    if (!tieneValor(antes, objetivo) && tieneValor(despues, objetivo)) {
      recienCumplidos.push(objetivo);
    }
  }
  return recienCumplidos;
}

function copiarVariables(origen: VariablesDeEstado, destino: Record<string, ValorDeEstado>): void {
  for (const nombre of Object.keys(origen)) {
    // Asignar la clave "__proto__" cambiaría el prototipo del objeto en vez de guardar una variable.
    if (nombre === '__proto__') continue;
    destino[nombre] = origen[nombre]!; // `nombre` viene de `Object.keys(origen)`, así que existe
  }
}
