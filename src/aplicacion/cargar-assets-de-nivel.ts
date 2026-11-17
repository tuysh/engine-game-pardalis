// Trae el manifiesto (`assets.json`) de cada carpeta de assets de un nivel y los une.
// Los problemas se anotan en el diagnóstico; una carpeta con problemas no impide revisar las demás.

import { unirManifiestos } from '../dominio/assets-de-nivel.ts';
import type { AssetsDeNivel, ManifiestoDeCarpeta } from '../dominio/assets-de-nivel.ts';
import type { DescripcionDeNivel } from '../dominio/descripcion-de-nivel.ts';
import type { Diagnostico } from '../dominio/diagnostico.ts';
import { ErrorDeEscenario } from '../dominio/error-de-escenario.ts';
import { NOMBRE_DEL_MANIFIESTO } from '../dominio/manifiesto.ts';
import type { LectorDeNiveles } from '../puertos/lector-de-niveles.ts';
import { direccionDeArchivoDeAssets } from './direccion-de-asset.ts';
import type { UbicacionDeAssets } from './direccion-de-asset.ts';

/** Lo que hace falta para traer los manifiestos de un nivel. */
export interface PedidoDeAssets {
  readonly descripcion: DescripcionDeNivel;
  readonly ubicacion: UbicacionDeAssets;
  readonly lector: LectorDeNiveles;
}

export async function cargarAssetsDeNivel(pedido: PedidoDeAssets, diagnostico: Diagnostico): Promise<AssetsDeNivel> {
  const manifiestos: ManifiestoDeCarpeta[] = [];

  for (const carpeta of pedido.descripcion.assets) {
    let direccion = '';
    let json: unknown;
    try {
      direccion = direccionDeArchivoDeAssets(carpeta, NOMBRE_DEL_MANIFIESTO, pedido.ubicacion);
      json = await pedido.ubicacion.cargador.cargarJson(direccion);
    } catch (error) {
      // Un manifiesto que no se pudo traer es un problema del nivel; cualquier otro error no se esconde.
      if (!(error instanceof ErrorDeEscenario)) throw error;
      for (const problema of error.problemas) {
        diagnostico.errores.push(`${problema}; el manifiesto se genera con: escenario-engine assets <carpeta>`);
      }
      continue;
    }

    const lectura = pedido.lector.leerManifiesto(json);
    if (lectura.tipo === 'invalido') {
      for (const error of lectura.errores) {
        diagnostico.errores.push(`${direccion}: ${error}`);
      }
      continue;
    }
    manifiestos.push({ carpeta, manifiesto: lectura.valor });
  }

  return unirManifiestos(manifiestos, diagnostico);
}
