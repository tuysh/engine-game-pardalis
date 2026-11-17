import { expect, test } from 'bun:test';
import {
  conCambios,
  crearEstadoDeNivel,
  estanCompletosLosObjetivos,
  objetivosQueFaltan,
  objetivosRecienCumplidos,
  tieneValor,
  valorDe,
} from './estado.ts';
import type { DeclaracionDeEstado } from './estado.ts';

const DECLARACION: DeclaracionDeEstado = {
  objetivos: ['tortillas', 'aguacates'],
  variables: ['globo'],
  lista: {},
};

test('un nivel empieza sin variables', () => {
  const estado = crearEstadoDeNivel(DECLARACION);

  expect(estado.variables).toEqual({});
  expect(valorDe(estado, 'tortillas')).toBeUndefined();
});

test('si el nivel declara dinero, empieza con esa cantidad', () => {
  const estado = crearEstadoDeNivel({ ...DECLARACION, dinero: 100 });

  expect(valorDe(estado, 'dinero')).toBe(100);
});

test('las variables guardadas mandan sobre los valores iniciales', () => {
  const estado = crearEstadoDeNivel({ ...DECLARACION, dinero: 100 }, { dinero: 40, tortillas: true });

  expect(valorDe(estado, 'dinero')).toBe(40);
  expect(valorDe(estado, 'tortillas')).toBe(true);
});

test('aplicar cambios devuelve un estado nuevo y deja intacto el anterior', () => {
  const antes = crearEstadoDeNivel(DECLARACION);

  const despues = conCambios(antes, { globo: 'rosa' });

  expect(valorDe(despues, 'globo')).toBe('rosa');
  expect(valorDe(antes, 'globo')).toBeUndefined();
});

test('una variable tiene valor si no es false, ni cero, ni texto vacío', () => {
  const estado = conCambios(crearEstadoDeNivel(DECLARACION), { a: true, b: 'rosa', c: 3, d: false, e: 0, f: '' });

  expect(tieneValor(estado, 'a')).toBe(true);
  expect(tieneValor(estado, 'b')).toBe(true);
  expect(tieneValor(estado, 'c')).toBe(true);
  expect(tieneValor(estado, 'd')).toBe(false);
  expect(tieneValor(estado, 'e')).toBe(false);
  expect(tieneValor(estado, 'f')).toBe(false);
  expect(tieneValor(estado, 'nunca_puesta')).toBe(false);
});

test('los objetivos que faltan salen en el orden en que el nivel los declara', () => {
  const sinNada = crearEstadoDeNivel(DECLARACION);
  const conAguacates = conCambios(sinNada, { aguacates: true });

  expect(objetivosQueFaltan(sinNada)).toEqual(['tortillas', 'aguacates']);
  expect(objetivosQueFaltan(conAguacates)).toEqual(['tortillas']);
});

test('los objetivos están completos cuando no falta ninguno', () => {
  const sinNada = crearEstadoDeNivel(DECLARACION);
  const conTodo = conCambios(sinNada, { tortillas: true, aguacates: true });

  expect(estanCompletosLosObjetivos(sinNada)).toBe(false);
  expect(estanCompletosLosObjetivos(conTodo)).toBe(true);
});

test('un nivel sin objetivos siempre los tiene completos', () => {
  const estado = crearEstadoDeNivel({ objetivos: [], variables: [], lista: {} });

  expect(estanCompletosLosObjetivos(estado)).toBe(true);
});

test('solo cuenta como recién cumplido el objetivo que antes no lo estaba', () => {
  const antes = conCambios(crearEstadoDeNivel(DECLARACION), { tortillas: true });
  const despues = conCambios(antes, { tortillas: true, aguacates: true, globo: 'rosa' });

  expect(objetivosRecienCumplidos(antes, despues)).toEqual(['aguacates']);
});

test('no confunde una variable con las propiedades que todo objeto de JavaScript trae', () => {
  const estado = crearEstadoDeNivel(DECLARACION);

  expect(valorDe(estado, 'constructor')).toBeUndefined();
  expect(valorDe(estado, 'toString')).toBeUndefined();
  expect(tieneValor(estado, 'constructor')).toBe(false);
});

test('ignora la clave __proto__ al copiar variables que vienen de afuera', () => {
  const variablesDeAfuera = JSON.parse('{ "__proto__": { "tortillas": true }, "globo": "rosa" }');

  const estado = crearEstadoDeNivel(DECLARACION, variablesDeAfuera);

  expect(valorDe(estado, 'globo')).toBe('rosa');
  expect(valorDe(estado, 'tortillas')).toBeUndefined();
  expect(Object.keys(estado.variables)).toEqual(['globo']);
});
