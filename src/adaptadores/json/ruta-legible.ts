// Convierte la ruta de un problema de Zod en el texto que se muestra a quien escribe niveles.
// Ejemplo: ['npcs', 'tortu', 'dialogo', 0] → 'npcs.tortu.dialogo[0]'.

/** Lo que se muestra cuando el problema está en el objeto principal del archivo y no en un campo. */
const NOMBRE_DE_LA_RAIZ = '(raíz)';

export function rutaLegible(ruta: readonly PropertyKey[]): string {
  let texto = '';
  for (const parte of ruta) {
    if (typeof parte === 'number') {
      texto += `[${parte}]`;
    } else if (texto === '') {
      texto = String(parte);
    } else {
      texto += `.${String(parte)}`;
    }
  }

  if (texto === '') return NOMBRE_DE_LA_RAIZ;
  return texto;
}
