// Comprueba las reglas de dependencia de AGENTS.md §3 leyendo los `import` de cada archivo de `src/`.
// Si falla, el mensaje dice qué archivo importó qué y a qué regla falta.
//
// Lo que esta prueba NO puede comprobar y se revisa a mano:
// que ningún archivo use `window` o `document` al cargarse (solo dentro de funciones).

import { expect, test } from 'bun:test';
import { readdirSync, readFileSync } from 'node:fs';
import { posix } from 'node:path';

const CARPETA_DE_CODIGO = new URL('.', import.meta.url).pathname;

/** Capas del centro, de adentro hacia afuera. Cada una puede importar de sí misma y de las anteriores. */
const CAPAS_DEL_CENTRO = ['dominio', 'puertos', 'aplicacion'];

/** Paquetes externos que cada adaptador puede importar. Un adaptador que no aparece aquí no importa ninguno. */
const PAQUETES_POR_ADAPTADOR: Record<string, readonly string[]> = {
  three: ['three'],
  json: ['zod'],
  archivos: ['node:fs', 'node:path'],
};

/** Únicos adaptadores que pueden usar `window` y `document`. */
const ADAPTADORES_DEL_NAVEGADOR = ['adaptadores/dom', 'adaptadores/audio', 'adaptadores/red'];

// Encuentra la ruta de cada importación. Acepta estas formas:
//   import { a } from './archivo.ts'     import './archivo.ts'     await import('./archivo.ts')
const EXPRESION_DE_IMPORTACION = /(?:from|import)\s*\(?\s*['"]([^'"]+)['"]/g;

// Encuentra usos de los objetos globales del navegador, como `window.innerWidth` o `document.body`.
const EXPRESION_DE_GLOBAL_DEL_NAVEGADOR = /\b(window|document)\./;

// Reconocen los comentarios que ocupan sus propias líneas: uno largo, desde un `/*` al inicio de una línea
// hasta su `*/`, y una línea que empieza con `//`. El código que siga en la misma línea de un `*/` se conserva.
const EXPRESION_DE_COMENTARIO_LARGO = /^[ \t]*\/\*[\s\S]*?\*\//gm;
const EXPRESION_DE_LINEA_DE_COMENTARIO = /^[ \t]*\/\/.*$/gm;

/**
 * Dice a qué capa pertenece un archivo según su ruta dentro de `src/`.
 * Ejemplos: `dominio/estado.ts` → `dominio`; `adaptadores/three/piso.ts` → `adaptadores/three`; `crear.ts` → `raiz`.
 */
function capaDe(rutaEnSrc: string): string {
  const partes = rutaEnSrc.split('/');
  if (partes.length === 1) return 'raiz';
  if (partes[0] === 'adaptadores') return `adaptadores/${partes[1]}`;
  return partes[0]!; // hay más de una parte, así que la primera existe
}

function capasQuePuedeImportar(capa: string, esPrueba: boolean): string[] {
  let permitidas: string[];
  if (capa.startsWith('adaptadores/')) {
    permitidas = ['dominio', 'puertos', capa];
  } else {
    const posicion = CAPAS_DEL_CENTRO.indexOf(capa);
    permitidas = CAPAS_DEL_CENTRO.slice(0, posicion + 1);
  }
  // Las pruebas usan las versiones falsas de los puertos.
  if (esPrueba) permitidas.push('adaptadores/memoria');
  return permitidas;
}

function paquetesQuePuedeImportar(capa: string, esPrueba: boolean): string[] {
  const nombreDelAdaptador = capa.replace('adaptadores/', '');
  const permitidos: string[] = [];
  if (Object.hasOwn(PAQUETES_POR_ADAPTADOR, nombreDelAdaptador)) {
    permitidos.push(...PAQUETES_POR_ADAPTADOR[nombreDelAdaptador]!); // `hasOwn` acaba de comprobar que existe
  }
  if (esPrueba) permitidos.push('bun:test');
  return permitidos;
}

/**
 * Quita los comentarios que ocupan sus propias líneas. Un ejemplo de uso escrito en la documentación
 * (`document.querySelector('#juego')`) no es código del motor, así que no cuenta como usar el navegador.
 */
function quitarComentarios(contenido: string): string {
  return contenido.replace(EXPRESION_DE_COMENTARIO_LARGO, '').replace(EXPRESION_DE_LINEA_DE_COMENTARIO, '');
}

/** Revisa un archivo y devuelve un mensaje por cada regla que rompe. Lista vacía = todo bien. */
function revisarArchivo(rutaEnSrc: string, contenido: string): string[] {
  const problemas: string[] = [];
  const capa = capaDe(rutaEnSrc);
  const esPrueba = rutaEnSrc.endsWith('.test.ts');

  const esUnIndiceQueNoEsLaEntrada = posix.basename(rutaEnSrc) === 'index.ts' && rutaEnSrc !== 'index.ts';
  if (esUnIndiceQueNoEsLaEntrada) {
    problemas.push(`${rutaEnSrc}: no se permiten archivos index.ts dentro de src/; importa del archivo real`);
  }

  const puedeUsarElNavegador = ADAPTADORES_DEL_NAVEGADOR.includes(capa);
  if (!puedeUsarElNavegador && EXPRESION_DE_GLOBAL_DEL_NAVEGADOR.test(quitarComentarios(contenido))) {
    problemas.push(`${rutaEnSrc}: usa window o document; eso solo se permite en ${ADAPTADORES_DEL_NAVEGADOR.join(', ')}`);
  }

  // La raíz (crear.ts, cli.ts, index.ts) es la que arma todo: puede importar lo que necesite.
  if (capa === 'raiz') return problemas;

  const capasPermitidas = capasQuePuedeImportar(capa, esPrueba);
  const paquetesPermitidos = paquetesQuePuedeImportar(capa, esPrueba);

  for (const coincidencia of contenido.matchAll(EXPRESION_DE_IMPORTACION)) {
    const importado = coincidencia[1]!; // el grupo 1 siempre existe cuando la expresión coincide
    const esRutaRelativa = importado.startsWith('.');

    if (!esRutaRelativa) {
      const nombreDelPaquete = importado.split('/')[0]!;
      if (!paquetesPermitidos.includes(nombreDelPaquete) && !paquetesPermitidos.includes(importado)) {
        problemas.push(`${rutaEnSrc}: importa el paquete "${importado}", que la capa ${capa} no puede usar`);
      }
      continue;
    }

    const rutaImportada = posix.join(posix.dirname(rutaEnSrc), importado);
    const capaImportada = capaDe(rutaImportada);
    if (!capasPermitidas.includes(capaImportada)) {
      const permitidas = capasPermitidas.join(', ');
      problemas.push(`${rutaEnSrc}: importa ${rutaImportada}, pero la capa ${capa} solo puede importar de ${permitidas}`);
    }
  }
  return problemas;
}

test('todos los archivos de src/ respetan las reglas de dependencia', () => {
  const rutas = readdirSync(CARPETA_DE_CODIGO, { recursive: true, encoding: 'utf8' });
  const problemas: string[] = [];

  for (const ruta of rutas) {
    if (!ruta.endsWith('.ts')) continue;
    // Este archivo se salta a sí mismo: sus ejemplos de código roto están escritos a propósito.
    if (ruta === 'arquitectura.test.ts') continue;
    const rutaEnSrc = ruta.replaceAll('\\', '/'); // en Windows las rutas llegan con barra invertida
    const contenido = readFileSync(CARPETA_DE_CODIGO + rutaEnSrc, 'utf8');
    problemas.push(...revisarArchivo(rutaEnSrc, contenido));
  }

  expect(problemas).toEqual([]);
});

// Las pruebas siguientes comprueban que la revisión de verdad detecta cada falta.

test('el dominio no puede importar de otra capa', () => {
  const problemas = revisarArchivo('dominio/nivel.ts', `import type { Reloj } from '../puertos/reloj.ts';`);

  expect(problemas).toEqual([
    'dominio/nivel.ts: importa puertos/reloj.ts, pero la capa dominio solo puede importar de dominio',
  ]);
});

test('el dominio no puede importar paquetes', () => {
  const problemas = revisarArchivo('dominio/nivel.ts', `import { z } from 'zod';`);

  expect(problemas).toEqual(['dominio/nivel.ts: importa el paquete "zod", que la capa dominio no puede usar']);
});

test('la aplicación no puede importar un adaptador', () => {
  const problemas = revisarArchivo(
    'aplicacion/cargar-nivel.ts',
    `import { EscenarioDeThree } from '../adaptadores/three/escenario-de-three.ts';`,
  );

  expect(problemas).toEqual([
    'aplicacion/cargar-nivel.ts: importa adaptadores/three/escenario-de-three.ts, ' +
      'pero la capa aplicacion solo puede importar de dominio, puertos, aplicacion',
  ]);
});

test('una prueba de la aplicación sí puede usar los adaptadores de memoria', () => {
  const problemas = revisarArchivo(
    'aplicacion/cargar-nivel.test.ts',
    `import { test } from 'bun:test';\nimport { RelojDeMemoria } from '../adaptadores/memoria/reloj-de-memoria.ts';`,
  );

  expect(problemas).toEqual([]);
});

test('un adaptador no puede importar de otro adaptador', () => {
  const problemas = revisarArchivo('adaptadores/dom/globo.ts', `import { Piso } from '../three/piso.ts';`);

  expect(problemas).toEqual([
    'adaptadores/dom/globo.ts: importa adaptadores/three/piso.ts, ' +
      'pero la capa adaptadores/dom solo puede importar de dominio, puertos, adaptadores/dom',
  ]);
});

test('cada librería externa vive en su adaptador', () => {
  const contenido = `import { Scene } from 'three';`;

  expect(revisarArchivo('adaptadores/three/piso.ts', contenido)).toEqual([]);
  expect(revisarArchivo('adaptadores/dom/globo.ts', contenido)).toEqual([
    'adaptadores/dom/globo.ts: importa el paquete "three", que la capa adaptadores/dom no puede usar',
  ]);
});

test('window y document solo se usan en los adaptadores del navegador', () => {
  const contenido = `const ancho = window.innerWidth;`;

  expect(revisarArchivo('adaptadores/dom/globo.ts', contenido)).toEqual([]);
  expect(revisarArchivo('aplicacion/cargar-nivel.ts', contenido)).toEqual([
    'aplicacion/cargar-nivel.ts: usa window o document; ' +
      'eso solo se permite en adaptadores/dom, adaptadores/audio, adaptadores/red',
  ]);
});

test('un ejemplo de uso dentro de un comentario no cuenta como usar el navegador', () => {
  const contenido = [
    '/**',
    ' * @example',
    " * const juego = await crearEscenario(document.querySelector('#juego'), opciones);",
    ' */',
    '// también: window.innerWidth',
    'export const SEGUNDOS = 2;',
  ].join('\n');

  expect(revisarArchivo('puertos/minijuego.ts', contenido)).toEqual([]);
});

test('el código que comparte línea con un comentario, o que empieza con `*`, sí cuenta como usar el navegador', () => {
  const problema = [
    'puertos/minijuego.ts: usa window o document; ' +
      'eso solo se permite en adaptadores/dom, adaptadores/audio, adaptadores/red',
  ];

  expect(revisarArchivo('puertos/minijuego.ts', '/* nota */ const ancho = window.innerWidth;')).toEqual(problema);
  expect(revisarArchivo('puertos/minijuego.ts', 'const area = alto\n  * window.innerWidth;')).toEqual(problema);
});

test('no se permiten archivos index.ts fuera de la entrada del paquete', () => {
  expect(revisarArchivo('index.ts', '')).toEqual([]);
  expect(revisarArchivo('dominio/index.ts', '')).toEqual([
    'dominio/index.ts: no se permiten archivos index.ts dentro de src/; importa del archivo real',
  ]);
});
