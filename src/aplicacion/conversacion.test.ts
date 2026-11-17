import { expect, test } from 'bun:test';
import { leerCondicionDeTexto } from '../dominio/condicion.ts';
import { AJUSTES_DEL_MUNDO_POR_DEFECTO } from '../dominio/contenido.ts';
import type { Contenido } from '../dominio/contenido.ts';
import { crearEstadoDeNivel, valorDe } from '../dominio/estado.ts';
import type { AccionesDePaso } from './acciones-de-paso.ts';
import { Conversacion } from './conversacion.ts';
import { EstadoEnJuego } from './estado-en-juego.ts';

const CONTENIDO: Contenido = {
  meta: { id: 'barrio', titulo: 'El barrio', personajes: { tortu: { idioma: 'es', sprite: 'spr_tortu' } } },
  mundo: AJUSTES_DEL_MUNDO_POR_DEFECTO,
  estado: { objetivos: ['tortillas'], variables: [], lista: {} },
  secuencias: { bloquea_salida: [{ tipo: 'linea', hablante: 'tortu', texto: '¡Espérate!' }] },
  npcs: {
    tortu: {
      dialogo: [
        {
          condicion: leerCondicionDeTexto('tengo tortillas'),
          pasos: [{ tipo: 'linea', hablante: 'tortu', texto: '¡Que te aprovechen!' }],
        },
        { pasos: [{ tipo: 'linea', hablante: 'tortu', texto: '¡Cuidado, el comal está caliente!' }] },
      ],
    },
  },
  interactivos: { comal: { dialogo: [{ pasos: [{ tipo: 'efecto', nombre: 'magia' }] }] } },
  cinematicas: {},
  comentarios: {},
};

/** Acciones falsas: terminan de inmediato y anotan en `bitacora` las líneas y los efectos. */
function crearAccionesFalsas(bitacora: string[]): AccionesDePaso {
  return {
    async decirLinea(linea, textoCompleto) {
      bitacora.push(textoCompleto);
    },
    async elegirOpcion() {
      return 0;
    },
    async reproducirEfecto(nombre) {
      bitacora.push(`efecto: ${nombre}`);
    },
    async caminar() {},
    async jugarMinijuego() {
      return { exito: true };
    },
  };
}

function crearEstado(): EstadoEnJuego {
  return new EstadoEnJuego(crearEstadoDeNivel(CONTENIDO.estado), () => {});
}

test('al hablar con alguien se usa la primera rama cuya condición se cumple', async () => {
  const bitacora: string[] = [];
  const estado = crearEstado();
  const acciones = crearAccionesFalsas(bitacora);
  const conversacion = new Conversacion({ contenido: CONTENIDO, estado, acciones, alFallar: () => {} });

  await conversacion.hablarCon('npcs', 'tortu');
  estado.aplicar({ tortillas: true });
  await conversacion.hablarCon('npcs', 'tortu');

  expect(bitacora).toEqual(['¡Cuidado, el comal está caliente!', '¡Que te aprovechen!']);
});

test('hablar con alguien marca "charlas.<id>"', async () => {
  const estado = crearEstado();
  const acciones = crearAccionesFalsas([]);
  const conversacion = new Conversacion({ contenido: CONTENIDO, estado, acciones, alFallar: () => {} });

  await conversacion.hablarCon('npcs', 'tortu');

  expect(valorDe(estado.actual, 'charlas.tortu')).toBe(true);
  expect(valorDe(estado.actual, 'charlas.comal')).toBeUndefined();
});

test('también se puede hablar con un interactivo', async () => {
  const bitacora: string[] = [];
  const conversacion = new Conversacion({
    contenido: CONTENIDO,
    estado: crearEstado(),
    acciones: crearAccionesFalsas(bitacora),
    alFallar: () => {},
  });

  await conversacion.hablarCon('interactivos', 'comal');

  expect(bitacora).toEqual(['efecto: magia']);
});

test('se pueden ejecutar pasos sueltos, como los de una salida bloqueada', async () => {
  const bitacora: string[] = [];
  const conversacion = new Conversacion({
    contenido: CONTENIDO,
    estado: crearEstado(),
    acciones: crearAccionesFalsas(bitacora),
    alFallar: () => {},
  });

  await conversacion.ejecutar({ tipo: 'secuencia', nombre: 'bloquea_salida' });

  expect(bitacora).toEqual(['¡Espérate!']);
});

test('mientras hay un diálogo en curso, otro no empieza', async () => {
  const bitacora: string[] = [];
  const acciones = crearAccionesFalsas(bitacora);
  let cerrarLaLinea = (): void => {};
  acciones.decirLinea = (linea, textoCompleto) => {
    bitacora.push(textoCompleto);
    return new Promise((terminar) => {
      cerrarLaLinea = terminar;
    });
  };
  const conversacion = new Conversacion({ contenido: CONTENIDO, estado: crearEstado(), acciones, alFallar: () => {} });

  const primerDialogo = conversacion.hablarCon('npcs', 'tortu');
  await conversacion.hablarCon('interactivos', 'comal');
  expect(conversacion.hayDialogoEnCurso).toBe(true);
  cerrarLaLinea();
  await primerDialogo;

  expect(bitacora).toEqual(['¡Cuidado, el comal está caliente!']);
  expect(conversacion.hayDialogoEnCurso).toBe(false);
});

test('interrumpir termina el diálogo en curso aunque la línea siga abierta, y deja hablar de nuevo', async () => {
  const bitacora: string[] = [];
  const acciones = crearAccionesFalsas(bitacora);
  acciones.decirLinea = () => new Promise(() => {}); // una línea que nadie cierra
  const conversacion = new Conversacion({ contenido: CONTENIDO, estado: crearEstado(), acciones, alFallar: () => {} });

  const dialogo = conversacion.hablarCon('npcs', 'tortu');
  conversacion.interrumpir();
  await dialogo;
  await conversacion.hablarCon('interactivos', 'comal');

  expect(bitacora).toEqual(['efecto: magia']);
});

test('si una acción falla, se avisa del error y el diálogo queda libre', async () => {
  const errores: unknown[] = [];
  const acciones = crearAccionesFalsas([]);
  const fallo = new Error('no se pudo dibujar el globo');
  acciones.decirLinea = () => Promise.reject(fallo);
  const conversacion = new Conversacion({
    contenido: CONTENIDO,
    estado: crearEstado(),
    acciones,
    alFallar: (error) => errores.push(error),
  });

  await conversacion.hablarCon('npcs', 'tortu');

  expect(errores).toEqual([fallo]);
  expect(conversacion.hayDialogoEnCurso).toBe(false);
});

test('hablar con alguien que no existe no hace nada', async () => {
  const estado = crearEstado();
  const acciones = crearAccionesFalsas([]);
  const conversacion = new Conversacion({ contenido: CONTENIDO, estado, acciones, alFallar: () => {} });

  await conversacion.hablarCon('npcs', 'constructor');

  expect(estado.actual.variables).toEqual({});
});
