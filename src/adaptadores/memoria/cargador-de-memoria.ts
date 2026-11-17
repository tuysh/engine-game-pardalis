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

  /**
   * Pone la ruta en la misma carpeta que el archivo base.
   * Limitación conocida: no entiende `..`; en las pruebas basta con nombres de archivo simples.
   */
  resolverJuntoA(direccionBase: string, rutaRelativa: string): string {
    const posicionDeLaUltimaBarra = direccionBase.lastIndexOf('/');
    const carpeta = direccionBase.slice(0, posicionDeLaUltimaBarra + 1);
    return carpeta + rutaRelativa;
  }
}
