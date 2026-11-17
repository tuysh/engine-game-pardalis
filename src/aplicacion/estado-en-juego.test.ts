import { expect, test } from 'bun:test';
import { crearEstadoDeNivel, valorDe } from '../dominio/estado.ts';
import { EstadoEnJuego } from './estado-en-juego.ts';

const ESTADO_INICIAL = crearEstadoDeNivel({ objetivos: ['tortillas', 'aguacates'], variables: ['globo'], lista: {} });

test('aplicar cambios actualiza el estado actual', () => {
  const estado = new EstadoEnJuego(ESTADO_INICIAL, () => {});

  estado.aplicar({ globo: 'rosa' });

  expect(valorDe(estado.actual, 'globo')).toBe('rosa');
});

test('avisa una vez por cada objetivo que se cumple', () => {
  const objetivosAvisados: string[] = [];
  const estado = new EstadoEnJuego(ESTADO_INICIAL, (objetivo) => objetivosAvisados.push(objetivo));

  estado.aplicar({ tortillas: true });
  estado.aplicar({ tortillas: true, globo: 'rosa' });
  estado.aplicar({ aguacates: true });

  expect(objetivosAvisados).toEqual(['tortillas', 'aguacates']);
});

test('cambiar una variable que no es objetivo no avisa nada', () => {
  const objetivosAvisados: string[] = [];
  const estado = new EstadoEnJuego(ESTADO_INICIAL, (objetivo) => objetivosAvisados.push(objetivo));

  estado.aplicar({ globo: 'rosa' });

  expect(objetivosAvisados).toEqual([]);
});
