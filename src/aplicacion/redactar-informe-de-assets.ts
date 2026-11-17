// Escribe el informe que la línea de comandos muestra después de generar un manifiesto de assets.
// Devuelve las líneas de texto; quien llama decide dónde imprimirlas.
//
// Ejemplo:
//   ⚠ img/cartel.svg: el SVG enlaza archivos externos (foto.png); al usarse como textura no se cargan
//   ✓ niveles/casa/assets.json generado (12 assets, 1 advertencia)

import { NOMBRE_DEL_MANIFIESTO } from '../dominio/manifiesto.ts';
import { contarConPlural } from './contar-con-plural.ts';
import type { ResultadoDeGenerar } from './generar-manifiesto.ts';

export function redactarInformeDeAssets(carpeta: string, resultado: ResultadoDeGenerar): string[] {
  const lineas: string[] = [];

  for (const advertencia of resultado.advertencias) {
    lineas.push(`⚠ ${advertencia}`);
  }
  for (const error of resultado.errores) {
    lineas.push(`✗ ${error}`);
  }

  const archivo = `${carpeta}/${NOMBRE_DEL_MANIFIESTO}`;
  const cuantasAdvertencias = contarConPlural(resultado.advertencias.length, 'advertencia', 'advertencias');

  if (resultado.errores.length > 0) {
    const cuantosErrores = contarConPlural(resultado.errores.length, 'error', 'errores');
    lineas.push(`✗ ${archivo} no se generó (${cuantosErrores}, ${cuantasAdvertencias})`);
  } else {
    const cuantosAssets = contarConPlural(resultado.cantidadDeAssets, 'asset', 'assets');
    lineas.push(`✓ ${archivo} generado (${cuantosAssets}, ${cuantasAdvertencias})`);
  }
  return lineas;
}
