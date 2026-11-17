// Convierte los argumentos de la línea de comandos en un comando con forma conocida.
// No ejecuta nada: `src/cli.ts` recibe el comando y decide qué hacer.

/** Lo que la persona pidió al escribir `escenario-engine ...` en la terminal. */
export type Comando =
  | { readonly tipo: 'validar'; readonly rutaDelNivel: string; readonly minijuegos?: readonly string[] }
  | { readonly tipo: 'assets'; readonly carpeta: string }
  | { readonly tipo: 'ayuda' }
  | { readonly tipo: 'invalido'; readonly mensaje: string };

/** Texto que se muestra con `escenario-engine ayuda` o cuando el comando no se entiende. */
export const TEXTO_DE_AYUDA = `Uso:
  escenario-engine validar <nivel.json> [--minijuegos A,B]
      Revisa un nivel y lista sus problemas. Con --minijuegos revisa también
      que cada paso "juego" nombre un minijuego de esa lista.
  escenario-engine assets <carpeta>
      Genera el assets.json de una carpeta.
  escenario-engine ayuda
      Muestra este texto.`;

const OPCION_DE_MINIJUEGOS = '--minijuegos';

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
  let minijuegos: string[] | undefined;
  let rutas = argumentos;

  const posicionDeLaOpcion = argumentos.indexOf(OPCION_DE_MINIJUEGOS);
  if (posicionDeLaOpcion >= 0) {
    const lista = argumentos[posicionDeLaOpcion + 1];
    if (lista === undefined) {
      return { tipo: 'invalido', mensaje: 'falta la lista de minijuegos: --minijuegos Tortilleria,Fruteria' };
    }
    minijuegos = lista.split(',');
    // Lo que queda después de quitar la opción y su lista son las rutas.
    const antesDeLaOpcion = argumentos.slice(0, posicionDeLaOpcion);
    const despuesDeLaLista = argumentos.slice(posicionDeLaOpcion + 2);
    rutas = [...antesDeLaOpcion, ...despuesDeLaLista];
  }

  const rutaDelNivel = rutas[0];
  if (rutaDelNivel === undefined) {
    return { tipo: 'invalido', mensaje: 'falta la ruta del nivel: escenario-engine validar <nivel.json>' };
  }
  return { tipo: 'validar', rutaDelNivel, minijuegos };
}
