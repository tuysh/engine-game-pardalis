// Servidor de la demo. Uso: `bun ejemplo/servidor.ts` y abrir http://localhost:3000
//
// Bun arma la página (`index.html` y el TypeScript que importa) y este archivo sirve, tal cual,
// los demás archivos de la carpeta `ejemplo/`: los niveles con sus mapas, imágenes y manifiestos.

import { join } from 'node:path';
import pagina from './index.html';

const CARPETA_DE_LA_DEMO = import.meta.dir;
const PUERTO_POR_DEFECTO = 3000;
const puerto = Number(process.env.PUERTO ?? PUERTO_POR_DEFECTO);

const servidor = Bun.serve({
  port: puerto,
  development: true,
  routes: { '/': pagina },
  async fetch(peticion) {
    const ruta = decodeURIComponent(new URL(peticion.url).pathname);
    // Nunca se sirve nada de fuera de la carpeta de la demo.
    if (ruta.split('/').includes('..')) {
      return new Response('ruta no permitida', { status: 400 });
    }

    const archivo = Bun.file(join(CARPETA_DE_LA_DEMO, ruta));
    if (!(await archivo.exists())) {
      return new Response(`no existe ${ruta}`, { status: 404 });
    }
    return new Response(archivo);
  },
});

console.log(`Demo de escenario-engine en ${servidor.url}`);
