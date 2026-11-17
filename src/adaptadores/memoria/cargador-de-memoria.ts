// Cargador falso para las pruebas: los «archivos» son datos que la prueba le entrega al crearlo.
//
// Uso:
//   const cargador = new CargadorDeMemoria({ 'niveles/casa/nivel.json': { mapa: 'mapa.tmj' } });

import { ErrorDeEscenario } from '../../dominio/error-de-escenario.ts';
import type { Cargador } from '../../puertos/cargador.ts';

export class CargadorDeMemoria implements Cargador {
  private readonly archivos: Readonly<Record<string, unknown>>;

  constructor(archivos: Readonly<Record<string, unknown>>) {
    this.archivos = archivos;
  }

  async cargarJson(direccion: string): Promise<unknown> {
    if (!Object.hasOwn(this.archivos, direccion)) {
      throw new ErrorDeEscenario([`no existe el archivo ${direccion}`]);
    }
    return this.archivos[direccion];
  }

  /** Pone la ruta en la misma carpeta que el archivo base, resolviendo los `.` y `..` que traiga. */
  resolverJuntoA(direccionBase: string, rutaRelativa: string): string {
    const partesDeLaBase = direccionBase.split('/');
    partesDeLaBase.pop(); // se quita el nombre del archivo base: queda su carpeta

    const partes = [...partesDeLaBase];
    for (const parte of rutaRelativa.split('/')) {
      if (parte === '' || parte === '.') continue;
      if (parte === '..') {
        partes.pop();
        continue;
      }
      partes.push(parte);
    }
    return partes.join('/');
  }
}
