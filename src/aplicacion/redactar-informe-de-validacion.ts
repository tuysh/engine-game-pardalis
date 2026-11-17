// Escribe el informe que la línea de comandos muestra después de validar un nivel.
// Devuelve las líneas de texto; quien llama decide dónde imprimirlas.
//
// Ejemplo:
//   ⚠ npcs.tortu.dialogo[1]: rama inalcanzable, hay una rama sin "cuando" antes; ...
//   ✗ secuencia "aun_no_item" usada en npcs.tortu.alVolver.siNo pero no existe en "secuencias"
//   ✗ niveles/barrio/nivel.json no es válido (1 error, 1 advertencia)

import { contarConPlural } from './contar-con-plural.ts';
import type { ResultadoDeValidacion } from './validar-nivel.ts';

export function redactarInformeDeValidacion(direccionDelNivel: string, resultado: ResultadoDeValidacion): string[] {
  const lineas: string[] = [];

  for (const advertencia of resultado.advertencias) {
    lineas.push(`⚠ ${advertencia}`);
  }
  for (const error of resultado.errores) {
    lineas.push(`✗ ${error}`);
  }

  const cuantosErrores = contarConPlural(resultado.errores.length, 'error', 'errores');
  const cuantasAdvertencias = contarConPlural(resultado.advertencias.length, 'advertencia', 'advertencias');
  const resumen = `(${cuantosErrores}, ${cuantasAdvertencias})`;

  if (resultado.errores.length > 0) {
    lineas.push(`✗ ${direccionDelNivel} no es válido ${resumen}`);
  } else {
    lineas.push(`✓ ${direccionDelNivel} es válido ${resumen}`);
  }
  return lineas;
}
