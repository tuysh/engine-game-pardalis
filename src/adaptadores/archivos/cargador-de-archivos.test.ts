import { expect, test } from 'bun:test';
import { ErrorDeEscenario } from '../../dominio/error-de-escenario.ts';
import { CargadorDeArchivos } from './cargador-de-archivos.ts';

// Estas pruebas leen archivos que ya existen en el repositorio, para no crear archivos temporales.
const RAIZ_DEL_PROYECTO = new URL('../../../', import.meta.url).pathname;

test('lee un archivo JSON del disco', async () => {
  const cargador = new CargadorDeArchivos();

  const json = await cargador.cargarJson(`${RAIZ_DEL_PROYECTO}package.json`);

  expect(json).toMatchObject({ name: '@pardalis/escenario-engine' });
});

test('un archivo que no existe se rechaza con un mensaje que lo nombra', async () => {
  const cargador = new CargadorDeArchivos();

  const lectura = cargador.cargarJson('/no/existe/nivel.json');

  await expect(lectura).rejects.toBeInstanceOf(ErrorDeEscenario);
  await expect(lectura).rejects.toMatchObject({ problemas: ['no existe el archivo /no/existe/nivel.json'] });
});

test('un archivo que no es JSON se rechaza diciendo que no es JSON válido', async () => {
  const cargador = new CargadorDeArchivos();
  const rutaDeUnArchivoDeTexto = `${RAIZ_DEL_PROYECTO}README.md`;

  const lectura = cargador.cargarJson(rutaDeUnArchivoDeTexto);

  await expect(lectura).rejects.toBeInstanceOf(ErrorDeEscenario);
  await expect(lectura).rejects.toMatchObject({
    problemas: [expect.stringContaining(`${rutaDeUnArchivoDeTexto} no es JSON válido: `)],
  });
});

test('resuelve una ruta relativa junto al archivo base, también con ".."', () => {
  const cargador = new CargadorDeArchivos();

  expect(cargador.resolverJuntoA('/niveles/casa/nivel.json', 'contenido.json')).toBe('/niveles/casa/contenido.json');
  expect(cargador.resolverJuntoA('/niveles/casa/nivel.json', '../comun')).toBe('/niveles/comun');
});
