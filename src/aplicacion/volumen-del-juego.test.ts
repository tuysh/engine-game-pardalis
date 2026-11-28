import { expect, test } from 'bun:test';
import { AudioDeMemoria } from '../adaptadores/memoria/audio-de-memoria.ts';
import { ErrorDeEscenario } from '../dominio/error-de-escenario.ts';
import { volumenDelCanal } from '../dominio/volumenes.ts';
import { VolumenDelJuego } from './volumen-del-juego.ts';

/** Los problemas del error que lanza `accion`. */
function problemasAl(accion: () => void): readonly string[] {
  try {
    accion();
  } catch (error) {
    if (error instanceof ErrorDeEscenario) return error.problemas;
    throw error;
  }
  throw new Error('se esperaba un ErrorDeEscenario');
}

test('el volumen general, el silencio y cada canal llegan al audio', () => {
  const audio = new AudioDeMemoria();
  const volumen = new VolumenDelJuego(audio);

  volumen.cambiarGeneral(0.5);
  volumen.cambiarCanales({ musica: 0.2 });
  expect(audio.volumenes).toEqual({ general: 0.5, musica: 0.2, voces: 1, efectos: 1, silenciado: false });
  expect(volumen.porCanal).toEqual({ musica: 0.2, voces: 1, efectos: 1 });

  volumen.cambiarSilencio(true);
  expect(audio.volumenes.silenciado).toBe(true);
  expect(volumen.general).toBe(0.5);
});

test('lo que se oye de un canal es su volumen por el general, y nada con el silencio', () => {
  const volumenes = { general: 0.5, musica: 0.4, voces: 1, efectos: 0, silenciado: false };

  expect(volumenDelCanal(volumenes, 'musica')).toBe(0.2);
  expect(volumenDelCanal(volumenes, 'voces')).toBe(0.5);
  expect(volumenDelCanal({ ...volumenes, silenciado: true }, 'voces')).toBe(0);
});

test('un volumen que no es un número de 0 a 1 se explica y no cambia nada', () => {
  const audio = new AudioDeMemoria();
  const volumen = new VolumenDelJuego(audio);

  expect(problemasAl(() => volumen.cambiarGeneral('alto'))).toEqual([
    'juego.volumen: se esperaba un número de 0 (callado) a 1 (completo); llegó "alto"',
  ]);
  expect(problemasAl(() => volumen.cambiarGeneral(50))).toEqual([
    'juego.volumen: se esperaba un número de 0 (callado) a 1 (completo); llegó 50',
  ]);
  expect(problemasAl(() => volumen.cambiarSilencio('si'))).toEqual([
    'juego.silenciado: se esperaba true (sin sonido) o false (con sonido); llegó "si"',
  ]);
  expect(volumen.general).toBe(1);
});

test('un canal que no existe o un volumen fuera de 0 a 1 se explican, y ningún canal cambia', () => {
  const audio = new AudioDeMemoria();
  const volumen = new VolumenDelJuego(audio);

  expect(problemasAl(() => volumen.cambiarCanales({ musca: 0.2, voces: 2, efectos: 0.5 }))).toEqual([
    'juego.ajustarVolumenes: no hay un canal "musca"; los canales son musica, voces y efectos',
    'juego.ajustarVolumenes: voces debe ser un número de 0 (callado) a 1 (completo); llegó 2',
  ]);
  expect(problemasAl(() => volumen.cambiarCanales(0.5))).toEqual([
    'juego.ajustarVolumenes: se esperaba un objeto como { musica: 0.3 }, con musica, voces o efectos de 0 a 1; ' +
      'llegó 0.5',
  ]);
  expect(volumen.porCanal).toEqual({ musica: 1, voces: 1, efectos: 1 });
});
