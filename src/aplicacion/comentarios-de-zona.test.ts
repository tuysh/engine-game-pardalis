import { expect, test } from 'bun:test';
import { AJUSTES_DEL_MUNDO_POR_DEFECTO } from '../dominio/contenido.ts';
import type { Contenido } from '../dominio/contenido.ts';
import type { Zona } from '../dominio/mundo.ts';
import { ComentariosDeZona } from './comentarios-de-zona.ts';

const CONTENIDO: Contenido = {
  meta: { id: 'barrio', titulo: 'El barrio', personajes: { tommy: { idioma: 'en', sprite: 'spr_tommy' } } },
  mundo: AJUSTES_DEL_MUNDO_POR_DEFECTO,
  estado: { objetivos: [], variables: [], lista: {} },
  secuencias: {},
  npcs: {},
  interactivos: {},
  comentarios: {
    general: [
      { tipo: 'linea', hablante: 'tommy', texto: 'Wow!' },
      { tipo: 'linea', hablante: 'tommy', texto: 'So many colors!' },
    ],
  },
};

/** La entrada del barrio: un cuadro de 2 × 2 metros que comenta con el grupo "general" cada 20 segundos. */
const ENTRADA: Zona = {
  descripcion: 'entrada',
  forma: { tipo: 'rectangulo', rectangulo: { x: 0, y: 0, ancho: 2, alto: 2 } },
  grupo: 'general',
  esperaEnSegundos: 20,
};

const DENTRO = { x: 1, y: 1 };
const FUERA = { x: 5, y: 5 };

/** Comentarios cuyo «decir» anota el texto y no termina hasta que la prueba lo cierra o se cancela. */
function crearComentarios(zonas: Record<string, Zona>, azar: () => number = () => 0) {
  const dichos: string[] = [];
  let cerrarElGlobo = (): void => {};
  const comentarios = new ComentariosDeZona({
    contenido: CONTENIDO,
    zonas,
    azar,
    decirComentario: (linea, senal) => {
      dichos.push(linea.texto);
      return new Promise((terminar) => {
        cerrarElGlobo = terminar;
        senal.addEventListener('abort', () => terminar(), { once: true });
      });
    },
    alFallar: () => {},
  });
  return { comentarios, dichos, cerrar: () => cerrarElGlobo() };
}

/** Deja que corra el código que estaba detenido en un `await`. */
function darTurno(): Promise<void> {
  return new Promise((continuar) => setTimeout(continuar, 0));
}

test('al entrar a una zona con grupo, el jugador dice un comentario de ese grupo', () => {
  const { comentarios, dichos } = crearComentarios({ entrada: ENTRADA });

  comentarios.avanzar(0.016, FUERA, true);
  comentarios.avanzar(0.016, DENTRO, true);

  expect(dichos).toEqual(['Wow!']);
  expect(comentarios.hayUnComentario).toBe(true);
});

test('el comentario se elige al azar dentro del grupo', () => {
  const siempreElUltimo = (): number => 0.99;
  const { comentarios, dichos } = crearComentarios({ entrada: ENTRADA }, siempreElUltimo);

  comentarios.avanzar(0.016, DENTRO, true);

  expect(dichos).toEqual(['So many colors!']);
});

test('mientras sigue dentro de la zona no vuelve a comentar', async () => {
  const { comentarios, dichos, cerrar } = crearComentarios({ entrada: ENTRADA });

  comentarios.avanzar(0.016, DENTRO, true);
  cerrar();
  await darTurno();
  comentarios.avanzar(30, DENTRO, true);

  expect(dichos).toEqual(['Wow!']);
});

test('al salir y volver a entrar, espera el tiempo de la zona antes de comentar otra vez', async () => {
  const { comentarios, dichos, cerrar } = crearComentarios({ entrada: ENTRADA });
  comentarios.avanzar(0.016, DENTRO, true);
  cerrar();
  await darTurno();

  comentarios.avanzar(5, FUERA, true);
  comentarios.avanzar(5, DENTRO, true); // van 10 segundos: todavía no
  expect(dichos).toEqual(['Wow!']);

  comentarios.avanzar(6, FUERA, true);
  comentarios.avanzar(6, DENTRO, true); // van 22 segundos: ya puede

  expect(dichos).toEqual(['Wow!', 'Wow!']);
});

test('durante un diálogo no comenta, ni al terminar el diálogo si ya estaba dentro', () => {
  const { comentarios, dichos } = crearComentarios({ entrada: ENTRADA });

  comentarios.avanzar(0.016, DENTRO, false);
  comentarios.avanzar(0.016, DENTRO, true);

  expect(dichos).toEqual([]);
});

test('callar termina el comentario en curso', async () => {
  const { comentarios } = crearComentarios({ entrada: ENTRADA });
  comentarios.avanzar(0.016, DENTRO, true);

  comentarios.callar();
  await darTurno();

  expect(comentarios.hayUnComentario).toBe(false);
});

test('una zona sin grupo no comenta nada', () => {
  const zonaSinGrupo: Zona = { ...ENTRADA, grupo: undefined };
  const { comentarios, dichos } = crearComentarios({ plaza: zonaSinGrupo });

  comentarios.avanzar(0.016, DENTRO, true);

  expect(dichos).toEqual([]);
});

test('si decir el comentario falla, se avisa y se puede volver a comentar después', async () => {
  const fallas: unknown[] = [];
  const fallo = new Error('no se pudo dibujar el globo');
  const comentarios = new ComentariosDeZona({
    contenido: CONTENIDO,
    zonas: { entrada: { ...ENTRADA, esperaEnSegundos: 0 } },
    azar: () => 0,
    decirComentario: () => Promise.reject(fallo),
    alFallar: (error) => fallas.push(error),
  });

  comentarios.avanzar(0.016, DENTRO, true);
  await darTurno();

  expect(fallas).toEqual([fallo]);
  expect(comentarios.hayUnComentario).toBe(false);
});
