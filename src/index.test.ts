// Cuida la entrada pública del paquete tal como la ve un host: qué se puede importar,
// que importarla no necesita navegador, y que usarla mal se explica con claridad.

import { expect, test } from 'bun:test';
import * as paquete from './index.ts';

test('la entrada pública ofrece solo crearEscenario y ErrorDeEscenario: lo demás son tipos', () => {
  expect(Object.keys(paquete).sort()).toEqual(['ErrorDeEscenario', 'crearEscenario']);
});

test('importar el paquete no necesita navegador: estas pruebas corren sin página', () => {
  expect(typeof document).toBe('undefined');
  expect(typeof paquete.crearEscenario).toBe('function');
});

test('llamar a crearEscenario sin navegador y con opciones malas rechaza diciendo todos los problemas', async () => {
  // Así llega una llamada mal hecha desde JavaScript sin tipos: sin elemento y con el nivel mal escrito.
  const elementoQueNoSeEncontro: unknown = null;
  const opcionesMalEscritas: unknown = { niveles: { casa: '/niveles/casa/nivel.json' }, nivel: 'csa' };

  const creacion = Reflect.apply(paquete.crearEscenario, undefined, [elementoQueNoSeEncontro, opcionesMalEscritas]);

  await expect(creacion).rejects.toEqual(
    new paquete.ErrorDeEscenario([
      'opciones.nivel: "csa" no está en "niveles" (casa) ni es la dirección de un nivel.json',
      'crearEscenario() necesita un navegador y aquí no hay página. Si el sitio también se arma en el servidor, ' +
        'llámalo solo en el navegador (por ejemplo, dentro de onMount o de un <script>)',
    ]),
  );
});
