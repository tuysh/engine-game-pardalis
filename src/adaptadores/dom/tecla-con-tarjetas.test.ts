import { expect, test } from 'bun:test';
import { queHaceLaTeclaConTarjetas, type TeclaConTarjetas } from './tecla-con-tarjetas.ts';

/** Tres tarjetas a la vista y el foco en el cuerpo de la página, como queda tras seguir el diálogo con `Enter`. */
function tecla(cambios: Partial<TeclaConTarjetas>): TeclaConTarjetas {
  return {
    tecla: 'Enter',
    repetida: false,
    conMayusculas: false,
    cantidad: 3,
    esDeUnControl: false,
    esDeUnCampo: false,
    nadaTieneElFoco: true,
    ...cambios,
  };
}

test('Enter o la barra con el foco en ningún lado llevan el foco a la primera tarjeta, sin elegirla', () => {
  expect(queHaceLaTeclaConTarjetas(tecla({ tecla: 'Enter' }))).toEqual({ tipo: 'enfocar', posicion: 0 });
  expect(queHaceLaTeclaConTarjetas(tecla({ tecla: ' ' }))).toEqual({ tipo: 'enfocar', posicion: 0 });
});

test('Enter que se quedó oprimido no hace nada, pero se cancela, aunque el foco ya esté en una tarjeta', () => {
  // La primera vez enfocó la primera tarjeta; si la repetición no se cancelara, el botón la elegiría.
  expect(queHaceLaTeclaConTarjetas(tecla({ repetida: true }))).toEqual({ tipo: 'ignorar' });
  expect(queHaceLaTeclaConTarjetas(tecla({ repetida: true, esDeUnControl: true, nadaTieneElFoco: false }))).toEqual({
    tipo: 'ignorar',
  });
  expect(queHaceLaTeclaConTarjetas(tecla({ tecla: ' ', repetida: true, esDeUnControl: true }))).toEqual({ tipo: 'ignorar' });
});

test('en un campo de texto del host, Enter es del campo aunque se quede oprimido', () => {
  const enUnCampo = { esDeUnControl: true, esDeUnCampo: true, nadaTieneElFoco: false };
  expect(queHaceLaTeclaConTarjetas(tecla({ ...enUnCampo }))).toEqual({ tipo: 'dejar' });
  expect(queHaceLaTeclaConTarjetas(tecla({ ...enUnCampo, repetida: true }))).toEqual({ tipo: 'dejar' });
});

test('Enter en una tarjeta o en un botón del host es de ese botón', () => {
  expect(queHaceLaTeclaConTarjetas(tecla({ esDeUnControl: true, nadaTieneElFoco: false }))).toEqual({ tipo: 'dejar' });
});

test('Tab con el foco en ningún lado va a la primera tarjeta, y con mayúsculas a la última', () => {
  expect(queHaceLaTeclaConTarjetas(tecla({ tecla: 'Tab' }))).toEqual({ tipo: 'enfocar', posicion: 0 });
  expect(queHaceLaTeclaConTarjetas(tecla({ tecla: 'Tab', conMayusculas: true }))).toEqual({ tipo: 'enfocar', posicion: 2 });
});

test('Tab desde un control sigue el orden de la página', () => {
  expect(queHaceLaTeclaConTarjetas(tecla({ tecla: 'Tab', esDeUnControl: true, nadaTieneElFoco: false }))).toEqual({
    tipo: 'dejar',
  });
});

test('las teclas 1 a la cantidad de tarjetas eligen, aunque el foco esté en otra tarjeta', () => {
  expect(queHaceLaTeclaConTarjetas(tecla({ tecla: '1' }))).toEqual({ tipo: 'elegir', posicion: 0 });
  expect(queHaceLaTeclaConTarjetas(tecla({ tecla: '3', esDeUnControl: true }))).toEqual({ tipo: 'elegir', posicion: 2 });
  expect(queHaceLaTeclaConTarjetas(tecla({ tecla: '4' }))).toEqual({ tipo: 'dejar' });
  expect(queHaceLaTeclaConTarjetas(tecla({ tecla: '0' }))).toEqual({ tipo: 'dejar' });
});

test('otra tecla no es para las tarjetas', () => {
  expect(queHaceLaTeclaConTarjetas(tecla({ tecla: 'e' }))).toEqual({ tipo: 'dejar' });
  expect(queHaceLaTeclaConTarjetas(tecla({ tecla: 'ArrowRight' }))).toEqual({ tipo: 'dejar' });
});
