import { expect, test } from 'bun:test';
import { redactarPlano } from './redactar-plano.ts';

test('un plano se escribe como el renglón que va en mundo.planos', () => {
  const texto = redactarPlano({ mira: 'tortu', distanciaEnMetros: 5.5, alturaEnMetros: 2.4, giroEnGrados: -14 });

  expect(texto).toBe('"plano_nuevo": { "mira": "tortu", "distancia": 5.5, "altura": 2.4, "giro": -14 }');
});

test('los metros se redondean a un decimal y el giro a grados enteros', () => {
  const texto = redactarPlano({ mira: 'puerta', distanciaEnMetros: 7.96, alturaEnMetros: 3.04, giroEnGrados: 19.6 });

  expect(texto).toBe('"plano_nuevo": { "mira": "puerta", "distancia": 8, "altura": 3, "giro": 20 }');
});

test('lo que resulta es JSON válido si se pone entre llaves', () => {
  const texto = redactarPlano({ mira: 'frente_tele', distanciaEnMetros: 6, alturaEnMetros: 2, giroEnGrados: 0 });

  expect(JSON.parse(`{ ${texto} }`)).toEqual({
    plano_nuevo: { mira: 'frente_tele', distancia: 6, altura: 2, giro: 0 },
  });
});
