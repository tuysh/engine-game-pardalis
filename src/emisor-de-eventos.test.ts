import { expect, test } from 'bun:test';
import { EmisorDeEventos } from './emisor-de-eventos.ts';

test('quien escucha un evento recibe su dato', () => {
  const emisor = new EmisorDeEventos();
  const objetivos: string[] = [];
  emisor.on('objetivo', (id) => objetivos.push(id));

  emisor.emitir('objetivo', 'tortillas');
  emisor.emitir('salida', 'Selector');

  expect(objetivos).toEqual(['tortillas']);
});

test('la función que devuelve "on" cancela la suscripción', () => {
  const emisor = new EmisorDeEventos();
  const objetivos: string[] = [];
  const cancelar = emisor.on('objetivo', (id) => objetivos.push(id));

  cancelar();
  emisor.emitir('objetivo', 'tortillas');

  expect(objetivos).toEqual([]);
});

test('vaciar olvida a todos los que escuchaban', () => {
  const emisor = new EmisorDeEventos();
  const destinos: string[] = [];
  emisor.on('salida', (destino) => destinos.push(destino));

  emisor.vaciar();
  emisor.emitir('salida', 'Selector');

  expect(destinos).toEqual([]);
});

test('si una función que escucha lanza un error, las demás reciben el evento y quien lo emite no se entera', () => {
  const emisor = new EmisorDeEventos();
  const destinos: string[] = [];
  emisor.on('salida', () => {
    throw new Error('un descuido del host');
  });
  emisor.on('salida', (destino) => destinos.push(destino));

  emisor.emitir('salida', 'Selector');

  expect(destinos).toEqual(['Selector']);
});
