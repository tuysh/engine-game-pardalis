import { expect, test } from 'bun:test';
import { esperarOCancelar } from './esperar-o-cancelar.ts';

/** Una promesa que nunca termina, como un minijuego que ignora la cancelación. */
function promesaQueNuncaTermina(): Promise<number> {
  return new Promise(() => {});
}

test('si la promesa termina, entrega su valor', async () => {
  const cancelador = new AbortController();

  const espera = await esperarOCancelar(Promise.resolve(7), cancelador.signal);

  expect(espera).toEqual({ tipo: 'termino', valor: 7 });
});

test('si se cancela antes, deja de esperar aunque la promesa nunca termine', async () => {
  const cancelador = new AbortController();

  const espera = esperarOCancelar(promesaQueNuncaTermina(), cancelador.signal);
  cancelador.abort();

  expect(await espera).toEqual({ tipo: 'cancelada' });
});

test('con una señal ya cancelada, ni siquiera espera', async () => {
  const cancelador = new AbortController();
  cancelador.abort();

  const espera = await esperarOCancelar(promesaQueNuncaTermina(), cancelador.signal);

  expect(espera).toEqual({ tipo: 'cancelada' });
});

test('si la promesa rechaza, el error no se esconde', async () => {
  const cancelador = new AbortController();
  const fallo = new Error('el minijuego falló');

  const espera = esperarOCancelar(Promise.reject(fallo), cancelador.signal);

  await expect(espera).rejects.toBe(fallo);
});
