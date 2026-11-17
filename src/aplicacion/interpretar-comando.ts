// Convierte los argumentos de la línea de comandos en un comando con forma conocida.
// No ejecuta nada: `src/cli.ts` recibe el comando y decide qué hacer.

/** Lo que la persona pidió al escribir `escenario-engine ...` en la terminal. */
export type Comando =
  | { readonly tipo: 'validar'; readonly rutaDelNivel: string }
  | { readonly tipo: 'assets'; readonly carpeta: string }
  | { readonly tipo: 'ayuda' }
  | { readonly tipo: 'invalido'; readonly mensaje: string };

/** Texto que se muestra con `escenario-engine ayuda` o cuando el comando no se entiende. */
export const TEXTO_DE_AYUDA = `Uso:
  escenario-engine validar <nivel.json>   Revisa un nivel y lista sus problemas
  escenario-engine assets <carpeta>       Genera el assets.json de una carpeta
  escenario-engine ayuda                  Muestra este texto`;

/**
 * Interpreta los argumentos tal como llegan después del nombre del programa.
 * Ejemplo: `['validar', 'niveles/casa/nivel.json']`.
 */
export function interpretarComando(argumentos: readonly string[]): Comando {
  const nombre = argumentos[0];
  const valor = argumentos[1];

  if (nombre === undefined || nombre === 'ayuda' || nombre === '--help' || nombre === '-h') {
    return { tipo: 'ayuda' };
  }

  switch (nombre) {
    case 'validar':
      if (valor === undefined) {
        return { tipo: 'invalido', mensaje: 'falta la ruta del nivel: escenario-engine validar <nivel.json>' };
      }
      return { tipo: 'validar', rutaDelNivel: valor };

    case 'assets':
      if (valor === undefined) {
        return { tipo: 'invalido', mensaje: 'falta la carpeta: escenario-engine assets <carpeta>' };
      }
      return { tipo: 'assets', carpeta: valor };

    default:
      return { tipo: 'invalido', mensaje: `no existe el comando "${nombre}"` };
  }
}
