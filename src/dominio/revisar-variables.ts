// Revisa que toda variable que un nivel usa esté declarada.
// Una variable se usa en dos lugares: en las condiciones y en los pasos `pon`.
//
// Están declaradas: los objetivos, las variables y las compartidas de la sección `estado`, el dinero (si el nivel lo usa),
// una variable `charlas.<id>` por cada NPC e interactivo (el motor la marca sola al hablar con él)
// y una variable `vista.<id>` por cada cinemática (el motor la marca sola cuando termina).

import { igualdadesDeTextoEn, variablesQueUsa } from './condicion.ts';
import type { Condicion, CondicionDeTextoIgual } from './condicion.ts';
import { PREFIJO_DE_CHARLAS, PREFIJO_DE_VISTAS } from './contenido.ts';
import type { Contenido } from './contenido.ts';
import { NOMBRE_DEL_DINERO } from './estado.ts';
import type { Revision } from './revision.ts';

// Algún signo de comparación. Lo encuentra en "dinero >= precio" y en "globo<mucho"; no en "charlas.tortu".
// Un nombre de variable con uno de estos signos es una comparación mal escrita
// (un texto a la derecha de >=, <=, > o <, o nada a la derecha).
const SIGNOS_DE_COMPARACION = /[<>=]/;

// Unas comillas, sencillas o dobles. Las encuentra en "premio = 'pizarron'".
const COMILLAS = /["']/;

// Los textos que alguien escribe cuando quiere preguntar por sí o no, no por un texto.
const TEXTOS_DE_SI_O_NO: readonly string[] = ['true', 'false', 'verdadero', 'falso', 'si', 'sí', 'no'];

/** Reúne los nombres de todas las variables que el contenido puede usar. */
export function reunirVariablesDeclaradas(contenido: Contenido): Set<string> {
  const declaradas = new Set<string>();

  for (const objetivo of contenido.estado.objetivos) {
    declaradas.add(objetivo);
  }
  for (const variable of contenido.estado.variables) {
    declaradas.add(variable);
  }
  for (const compartida of contenido.estado.compartidas ?? []) {
    declaradas.add(compartida);
  }
  if (contenido.estado.dinero !== undefined) {
    declaradas.add(NOMBRE_DEL_DINERO);
  }
  for (const id of Object.keys(contenido.npcs)) {
    declaradas.add(PREFIJO_DE_CHARLAS + id);
  }
  for (const id of Object.keys(contenido.interactivos)) {
    declaradas.add(PREFIJO_DE_CHARLAS + id);
  }
  for (const id of Object.keys(contenido.cinematicas)) {
    declaradas.add(PREFIJO_DE_VISTAS + id);
  }
  return declaradas;
}

/** Anota un error por cada variable sin declarar que la condición usa. Una condición ausente no se revisa. */
export function revisarCondicion(condicion: Condicion | undefined, ruta: string, revision: Revision): void {
  if (condicion === undefined) return;

  for (const nombre of variablesQueUsa(condicion)) {
    if (revision.variablesDeclaradas.has(nombre)) continue;
    const motivo = explicarPorQueNoEstaDeclarada(nombre);
    revision.diagnostico.errores.push(`condición "${nombre}" usada en ${ruta}: ${motivo}`);
  }
  for (const igualdad of igualdadesDeTextoEn(condicion)) {
    revisarIgualdadDeTexto(igualdad, ruta, revision);
  }
}

/**
 * Anota un error si una igualdad de texto nunca podría cumplirse por cómo está escrita:
 * con comillas, preguntando por sí o no, o con una variable que solo guarda «ya pasó».
 */
function revisarIgualdadDeTexto(igualdad: CondicionDeTextoIgual, ruta: string, revision: Revision): void {
  const motivo = explicarPorQueNuncaSeCumple(igualdad, revision.contenido);
  if (motivo === undefined) return;
  const escrita = `${igualdad.nombre} = ${igualdad.texto}`;
  revision.diagnostico.errores.push(`condición "${escrita}" usada en ${ruta}: ${motivo}`);
}

function explicarPorQueNuncaSeCumple(igualdad: CondicionDeTextoIgual, contenido: Contenido): string | undefined {
  const { nombre, texto } = igualdad;
  if (COMILLAS.test(texto)) {
    return 'el texto de la derecha va sin comillas, como "premio = pizarron"';
  }
  if (TEXTOS_DE_SI_O_NO.includes(texto.toLowerCase())) {
    return `para preguntar si "${nombre}" ya tiene valor se escribe "tengo ${nombre}" o "no ${nombre}"`;
  }
  const soloGuardaSiYaPaso =
    contenido.estado.objetivos.includes(nombre) ||
    nombre.startsWith(PREFIJO_DE_CHARLAS) ||
    nombre.startsWith(PREFIJO_DE_VISTAS);
  if (soloGuardaSiYaPaso) {
    return `"${nombre}" solo guarda si ya pasó, nunca un texto; se pregunta con "tengo ${nombre}"`;
  }
  return undefined;
}

/** Anota un error si un paso `pon` cambia una variable sin declarar. */
export function revisarVariableDePon(nombre: string, ruta: string, revision: Revision): void {
  if (revision.variablesDeclaradas.has(nombre)) return;
  const motivo = explicarPorQueNoEstaDeclarada(nombre);
  revision.diagnostico.errores.push(`"pon" de "${nombre}" en ${ruta}: ${motivo}`);
}

function explicarPorQueNoEstaDeclarada(nombre: string): string {
  if (nombre.startsWith(PREFIJO_DE_CHARLAS)) {
    const id = nombre.slice(PREFIJO_DE_CHARLAS.length);
    return `no existe "${id}" en npcs ni en interactivos`;
  }
  if (nombre.startsWith(PREFIJO_DE_VISTAS)) {
    const id = nombre.slice(PREFIJO_DE_VISTAS.length);
    return `no existe la cinemática "${id}"`;
  }
  if (SIGNOS_DE_COMPARACION.test(nombre)) {
    return (
      'una comparación lleva el nombre de una variable, un signo (>=, <=, >, < o =) y un número, como "dinero >= 10"; ' +
      'con un texto a la derecha solo se usa =, como "premio = pizarron"'
    );
  }
  return 'no está en estado.objetivos, ni en estado.variables, ni en estado.compartidas';
}
