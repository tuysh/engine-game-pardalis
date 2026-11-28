// Revisa que {falta_o_faltan} pueda concordar con cada objetivo: para elegir entre «falta» y «faltan» necesita
// saber si el nombre del objetivo en `estado.lista` es singular o plural, y eso lo dice su artículo.
// Si no se sabe, el texto dice «faltan»; por eso es advertencia y no error.

import { numeroGramaticalDe } from './numero-gramatical.ts';
import type { Revision } from './revision.ts';
import { nombreConArticulo } from './texto-con-variables.ts';

/**
 * Anota una advertencia por cada objetivo cuyo nombre no dice si es singular o plural.
 * Se puede llamar una vez por cada texto que usa {falta_o_faltan}: cada advertencia se anota una sola vez.
 */
export function revisarConcordanciaDeFaltan(revision: Revision): void {
  const declaracion = revision.contenido.estado;
  for (const objetivo of declaracion.objetivos) {
    const nombre = nombreConArticulo(objetivo, declaracion);
    if (numeroGramaticalDe(nombre) !== undefined) continue;

    const advertencia =
      `estado.lista.${objetivo}: "${nombre}" no empieza con el, la, los, las, un, una, unos o unas; ` +
      '{falta_o_faltan} dirá «faltan» cuando sea lo único que falta';
    if (revision.diagnostico.advertencias.includes(advertencia)) continue;
    revision.diagnostico.advertencias.push(advertencia);
  }
}
