// Cuando el host da `raizDeAssets` (una carpeta o un CDN), los assets ya no se buscan junto a cada
// `nivel.json`, sino bajo esa raíz, con la misma estructura de carpetas (docs/DISENO-3.0.md §8.3).
//
// La raíz ocupa el lugar de la carpeta que contiene a las carpetas de los niveles:
//
//   nivel:    /niveles/barrio/nivel.json      raíz: https://assets.pardalis.mx/aventura/
//   carpeta "."         archivo img/spr_tortu.svg  →  barrio/img/spr_tortu.svg
//   carpeta "../comun"  archivo img/spr_tommy.svg  →  comun/img/spr_tommy.svg

/**
 * La ruta de un archivo de assets a partir de la raíz.
 * Devuelve `undefined` si la carpeta sube tanto con `..` que se sale de la raíz.
 */
export function rutaDesdeLaRaizDeAssets(direccionDelNivel: string, carpeta: string, archivo: string): string | undefined {
  const partesDelNivel = direccionDelNivel.split('/');
  // La última parte es "nivel.json"; la anterior es la carpeta del nivel. Si no hay, el nivel está en la raíz.
  const carpetaDelNivel = partesDelNivel[partesDelNivel.length - 2] ?? '';

  const partes = [carpetaDelNivel, ...carpeta.split('/'), ...archivo.split('/')];
  const ruta: string[] = [];
  for (const parte of partes) {
    if (parte === '' || parte === '.') continue;
    if (parte === '..') {
      if (ruta.length === 0) return undefined;
      ruta.pop();
      continue;
    }
    ruta.push(parte);
  }
  return ruta.join('/');
}
