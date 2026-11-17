// Convierte los argumentos de la línea de comandos en un comando con forma conocida.
// No ejecuta nada: `src/cli.ts` recibe el comando y decide qué hacer.

/** Lo que la persona pidió al escribir `escenario-engine ...` en la terminal. */
export type Comando =
  | {
      readonly tipo: 'validar';
      readonly rutaDelNivel: string;
      readonly minijuegos?: readonly string[];
      readonly cinematicas?: readonly string[];
    }
  | { readonly tipo: 'assets'; readonly carpeta: string }
  | { readonly tipo: 'ayuda' }
  | { readonly tipo: 'invalido'; readonly mensaje: string };

/** Texto que se muestra con `escenario-engine ayuda` o cuando el comando no se entiende. */
export const TEXTO_DE_AYUDA = `Uso:
  escenario-engine validar <nivel.json> [--minijuegos A,B] [--cinematicas C,D]
      Revisa un nivel y lista sus problemas. Con --minijuegos revisa también
      que cada paso "juego" nombre un minijuego de esa lista, y con --cinematicas,
      que cada cinemática en código esté en esa otra.
  escenario-engine assets <carpeta>
      Genera el assets.json de una carpeta de assets, a partir de sus imágenes,
      sonidos y videos. Hay que volver a generarlo cuando cambian los archivos.
  escenario-engine ayuda
      Muestra este texto.`;

const OPCION_DE_MINIJUEGOS = '--minijuegos';
const OPCION_DE_CINEMATICAS = '--cinematicas';

/**
 * Interpreta los argumentos tal como llegan después del nombre del programa.
 * Ejemplo: `['validar', 'niveles/casa/nivel.json']`.
 */
export function interpretarComando(argumentos: readonly string[]): Comando {
  const nombre = argumentos[0];
  const losDemas = argumentos.slice(1);

  if (nombre === undefined || nombre === 'ayuda' || nombre === '--help' || nombre === '-h') {
    return { tipo: 'ayuda' };
  }

  switch (nombre) {
    case 'validar':
      return interpretarValidar(losDemas);

    case 'assets': {
      const carpeta = losDemas[0];
      if (carpeta === undefined) {
        return { tipo: 'invalido', mensaje: 'falta la carpeta: escenario-engine assets <carpeta>' };
      }
      return { tipo: 'assets', carpeta };
    }

    default:
      return { tipo: 'invalido', mensaje: `no existe el comando "${nombre}"` };
  }
}

function interpretarValidar(argumentos: readonly string[]): Comando {
  const minijuegos = separarOpcionConLista(argumentos, OPCION_DE_MINIJUEGOS);
  if (minijuegos.faltaLaLista) {
    return { tipo: 'invalido', mensaje: 'falta la lista de minijuegos: --minijuegos Tortilleria,Fruteria' };
  }
  const cinematicas = separarOpcionConLista(minijuegos.losDemas, OPCION_DE_CINEMATICAS);
  if (cinematicas.faltaLaLista) {
    return { tipo: 'invalido', mensaje: 'falta la lista de cinemáticas: --cinematicas intro,final' };
  }

  const rutaDelNivel = cinematicas.losDemas[0];
  if (rutaDelNivel === undefined) {
    return { tipo: 'invalido', mensaje: 'falta la ruta del nivel: escenario-engine validar <nivel.json>' };
  }
  return { tipo: 'validar', rutaDelNivel, minijuegos: minijuegos.lista, cinematicas: cinematicas.lista };
}

/** Lo que queda al sacar de los argumentos una opción con su lista, como `--minijuegos A,B`. */
interface OpcionSeparada {
  /** La lista que traía la opción. `undefined` = la opción no se escribió. */
  readonly lista?: string[];
  /** `true` si la opción se escribió sin su lista después. */
  readonly faltaLaLista: boolean;
  /** Los argumentos que no son la opción ni su lista. */
  readonly losDemas: readonly string[];
}

function separarOpcionConLista(argumentos: readonly string[], opcion: string): OpcionSeparada {
  const posicionDeLaOpcion = argumentos.indexOf(opcion);
  if (posicionDeLaOpcion < 0) {
    return { faltaLaLista: false, losDemas: argumentos };
  }

  const lista = argumentos[posicionDeLaOpcion + 1];
  if (lista === undefined) {
    return { faltaLaLista: true, losDemas: argumentos };
  }
  const antesDeLaOpcion = argumentos.slice(0, posicionDeLaOpcion);
  const despuesDeLaLista = argumentos.slice(posicionDeLaOpcion + 2);
  return { lista: lista.split(','), faltaLaLista: false, losDemas: [...antesDeLaOpcion, ...despuesDeLaLista] };
}
