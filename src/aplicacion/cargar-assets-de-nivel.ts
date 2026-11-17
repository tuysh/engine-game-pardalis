// Trae el manifiesto (`assets.json`) de cada carpeta de assets de un nivel y los une.
// Los problemas se anotan en el diagnóstico; una carpeta con problemas no impide revisar las demás.

import { unirManifiestos } from '../dominio/assets-de-nivel.ts';
import type { AssetsDeNivel, ManifiestoDeCarpeta } from '../dominio/assets-de-nivel.ts';
import type { DescripcionDeNivel } from '../dominio/descripcion-de-nivel.ts';
import type { Diagnostico } from '../dominio/diagnostico.ts';
import { ErrorDeEscenario } from '../dominio/error-de-escenario.ts';
import { NOMBRE_DEL_MANIFIESTO } from '../dominio/manifiesto.ts';
import type { Cargador } from '../puertos/cargador.ts';
import type { LectorDeNiveles } from '../puertos/lector-de-niveles.ts';

/** Lo que hace falta para traer los manifiestos de un nivel. */
export interface PedidoDeAssets {
  /** Dirección del `nivel.json`: las carpetas de assets son relativas a él. */
  readonly direccionDelNivel: string;
  readonly descripcion: DescripcionDeNivel;
  readonly cargador: Cargador;
  readonly lector: LectorDeNiveles;
}

export async function cargarAssetsDeNivel(pedido: PedidoDeAssets, diagnostico: Diagnostico): Promise<AssetsDeNivel> {
  const manifiestos: ManifiestoDeCarpeta[] = [];

  for (const carpeta of pedido.descripcion.assets) {
    const direccion = pedido.cargador.resolverJuntoA(pedido.direccionDelNivel, rutaDelManifiesto(carpeta));

    let json: unknown;
    try {
      json = await pedido.cargador.cargarJson(direccion);
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

/** Ruta del manifiesto de una carpeta de assets, relativa a `nivel.json`. */
function rutaDelManifiesto(carpeta: string): string {
  // "." es la carpeta del propio nivel: el manifiesto está junto a `nivel.json`.
  if (carpeta === '.') return NOMBRE_DEL_MANIFIESTO;
  return `${carpeta}/${NOMBRE_DEL_MANIFIESTO}`;
}
