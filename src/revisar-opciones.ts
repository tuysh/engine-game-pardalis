// Revisa lo que el host le entrega a `crearEscenario()` antes de usarlo.
//
// Las opciones vienen de afuera, muchas veces de JavaScript sin tipos. Un descuido (un nombre mal escrito,
// una función que no se importó, un id de nivel que no existe) se explica aquí con un mensaje claro,
// en vez de aparecer más tarde como un error difícil de rastrear. Todos los problemas se dicen juntos.

import { describirValor } from './dominio/describir-valor.ts';
import { esObjetoPlano } from './dominio/es-objeto-plano.ts';
import type { OpcionesDeEscenario } from './opciones-de-escenario.ts';

/** Lo que encontró la revisión. */
export interface RevisionDeOpciones {
  /** Con alguno de estos, el juego no puede arrancar. */
  readonly errores: readonly string[];
  /** Con estos sí arranca, pero hay algo que revisar. */
  readonly advertencias: readonly string[];
}

/**
 * Las opciones que `crearEscenario()` conoce (docs/DISENO-3.0.md §4).
 *
 * Es un objeto con una entrada por opción (y no una lista) para que TypeScript avise si a
 * `OpcionesDeEscenario` se le agrega una opción y aquí se olvida: sin eso, la opción nueva
 * daría la advertencia de que «no existe».
 */
const OPCIONES_QUE_EXISTEN: Readonly<Record<keyof OpcionesDeEscenario, true>> = {
  niveles: true,
  nivel: true,
  minijuegos: true,
  cinematicas: true,
  partida: true,
  raizDeAssets: true,
  origenesPermitidos: true,
  idioma: true,
  iniciarCon: true,
  proyeccion: true,
  alCargar: true,
  senal: true,
  depurar: true,
  semilla: true,
};

export function revisarOpciones(opciones: unknown): RevisionDeOpciones {
  if (!esObjetoPlano(opciones)) {
    const error =
      'opciones: el segundo argumento de crearEscenario() debe ser un objeto con las opciones; ' +
      `la única obligatoria es "nivel", por ejemplo { nivel: '/niveles/casa/nivel.json' }; ` +
      `llegó ${describirValor(opciones)}`;
    return { errores: [error], advertencias: [] };
  }

  const errores: string[] = [];
  const idsDeNiveles = revisarNiveles(opciones.niveles, errores);
  revisarNivelInicial(opciones.nivel, idsDeNiveles, errores);
  revisarFunciones(opciones.minijuegos, 'minijuegos', errores);
  revisarFunciones(opciones.cinematicas, 'cinematicas', errores);
  revisarAjustes(opciones, errores);
  return { errores, advertencias: buscarOpcionesQueNoExisten(opciones) };
}

/** `niveles` une el id de cada nivel con su dirección. Devuelve los ids que registra. */
function revisarNiveles(niveles: unknown, errores: string[]): string[] {
  if (niveles === undefined) return [];
  if (!esObjetoPlano(niveles)) {
    errores.push(
      'opciones.niveles: debe ser un objeto que une el id de cada nivel con la dirección de su nivel.json; ' +
        `llegó ${describirValor(niveles)}`,
    );
    return [];
  }

  const ids = Object.keys(niveles);
  for (const id of ids) {
    const direccion = niveles[id];
    if (typeof direccion !== 'string' || direccion === '') {
      errores.push(
        `opciones.niveles.${id}: debe ser la dirección de un nivel.json; llegó ${describirValor(direccion)}`,
      );
    }
  }
  return ids;
}

/** `nivel` es uno de los ids de `niveles` o directamente la dirección de un nivel.json. */
function revisarNivelInicial(nivel: unknown, idsDeNiveles: readonly string[], errores: string[]): void {
  if (typeof nivel !== 'string' || nivel === '') {
    errores.push(
      'opciones.nivel: falta el nivel inicial; debe ser un id de "niveles" o la dirección de un nivel.json; ' +
        `llegó ${describirValor(nivel)}`,
    );
    return;
  }
  // Una dirección lleva al menos una diagonal o un punto ("/niveles/casa/nivel.json"); un id, no ("casa").
  const pareceUnaDireccion = nivel.includes('/') || nivel.includes('.');
  if (idsDeNiveles.includes(nivel) || pareceUnaDireccion) return;

  if (idsDeNiveles.length === 0) {
    errores.push(
      `opciones.nivel: "${nivel}" no es la dirección de un nivel.json, y no hay "niveles" donde buscarlo por id`,
    );
    return;
  }
  const registrados = idsDeNiveles.join(', ');
  errores.push(`opciones.nivel: "${nivel}" no está en "niveles" (${registrados}) ni es la dirección de un nivel.json`);
}

/** `minijuegos` y `cinematicas` unen un nombre con una función: lo más común es que falte importar una. */
function revisarFunciones(valor: unknown, opcion: string, errores: string[]): void {
  if (valor === undefined) return;
  if (!esObjetoPlano(valor)) {
    errores.push(
      `opciones.${opcion}: debe ser un objeto que une cada nombre con su función; llegó ${describirValor(valor)}`,
    );
    return;
  }
  for (const nombre of Object.keys(valor)) {
    if (typeof valor[nombre] !== 'function') {
      errores.push(
        `opciones.${opcion}.${nombre}: debe ser una función; llegó ${describirValor(valor[nombre])} ` +
          '(¿falta importarla o está mal escrito su nombre?)',
      );
    }
  }
}

/** Las opciones que son un solo valor: cada una con lo que acepta. */
function revisarAjustes(opciones: Record<string, unknown>, errores: string[]): void {
  const anotar = (opcion: string, loQueAcepta: string): void => {
    errores.push(`opciones.${opcion}: debe ser ${loQueAcepta}; llegó ${describirValor(opciones[opcion])}`);
  };
  const { idioma, iniciarCon, origenesPermitidos, raizDeAssets, alCargar, senal, semilla } = opciones;

  if (idioma !== undefined && idioma !== 'es' && idioma !== 'en') {
    anotar('idioma', '"es" o "en"');
  }
  if (iniciarCon !== undefined && iniciarCon !== 'boton' && iniciarCon !== 'host') {
    anotar('iniciarCon', '"boton" o "host"');
  }
  const sonTextos = Array.isArray(origenesPermitidos) && origenesPermitidos.every((origen) => typeof origen === 'string');
  if (origenesPermitidos !== undefined && !sonTextos) {
    anotar('origenesPermitidos', 'una lista de orígenes, como ["https://assets.pardalis.mx"]');
  }
  if (raizDeAssets !== undefined && typeof raizDeAssets !== 'string') {
    anotar('raizDeAssets', 'la dirección de una carpeta o de un CDN');
  }
  if (alCargar !== undefined && typeof alCargar !== 'function') {
    anotar('alCargar', 'una función');
  }
  if (senal !== undefined && !(senal instanceof AbortSignal)) {
    anotar('senal', 'la señal de un AbortController (controlador.signal)');
  }
  if (semilla !== undefined && (typeof semilla !== 'number' || !Number.isFinite(semilla))) {
    anotar('semilla', 'un número');
  }
  for (const opcion of ['proyeccion', 'depurar']) {
    if (opciones[opcion] !== undefined && typeof opciones[opcion] !== 'boolean') {
      anotar(opcion, 'true o false');
    }
  }
}

/** Una opción que el motor no conoce casi siempre es un error de dedo: se avisa, pero no impide jugar. */
function buscarOpcionesQueNoExisten(opciones: Record<string, unknown>): string[] {
  const advertencias: string[] = [];
  for (const opcion of Object.keys(opciones)) {
    if (!Object.hasOwn(OPCIONES_QUE_EXISTEN, opcion)) {
      const lasQueExisten = Object.keys(OPCIONES_QUE_EXISTEN).join(', ');
      advertencias.push(`opciones.${opcion}: esa opción no existe y se ignora; las opciones son: ${lasQueExisten}`);
    }
  }
  return advertencias;
}
