import { expect, test } from 'bun:test';
import { AJUSTES_DEL_MUNDO_POR_DEFECTO } from './contenido.ts';
import type { Contenido } from './contenido.ts';
import { crearDiagnostico } from './diagnostico.ts';
import { revisarConcordanciaDeFaltan } from './revisar-concordancia.ts';
import type { Revision } from './revision.ts';

/** Un contenido con un objetivo singular, uno plural, uno sin artículo y uno que no está en la lista. */
const CONTENIDO: Contenido = {
  meta: { id: 'mercado', titulo: 'El mercado', personajes: { pardi: { idioma: 'es', sprite: 'spr_pardi' } } },
  jugador: { personaje: 'pardi', velocidadEnMetrosPorSegundo: 2.4 },
  mundo: AJUSTES_DEL_MUNDO_POR_DEFECTO,
  estado: {
    objetivos: ['maiz', 'chiles', 'pan', 'sal'],
    variables: [],
    lista: { maiz: 'el maíz', chiles: 'Los chiles', pan: 'pan' },
  },
  secuencias: {},
  npcs: {},
  interactivos: {},
  cinematicas: {},
  comentarios: {},
};

test('avisa de cada objetivo cuyo nombre no dice si es singular o plural, una sola vez aunque se llame dos', () => {
  const revision: Revision = { contenido: CONTENIDO, variablesDeclaradas: new Set(), diagnostico: crearDiagnostico() };

  revisarConcordanciaDeFaltan(revision);
  revisarConcordanciaDeFaltan(revision);

  expect(revision.diagnostico.errores).toEqual([]);
  expect(revision.diagnostico.advertencias).toEqual([
    'estado.lista.pan: "pan" no empieza con el, la, los, las, un, una, unos o unas; ' +
      '{falta_o_faltan} dirá «faltan» cuando sea lo único que falta',
    'estado.lista.sal: "sal" no empieza con el, la, los, las, un, una, unos o unas; ' +
      '{falta_o_faltan} dirá «faltan» cuando sea lo único que falta',
  ]);
});
