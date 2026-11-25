// La demo del motor: empieza en la casa, cuya cinemática de entrada lleva al barrio.
// Se abre con `bun ejemplo/servidor.ts`. Es también un ejemplo de cómo usa el paquete un host sin framework.
//
// Para probar un nivel sin pasar por el anterior, se le nombra en la dirección:
//   http://localhost:3000/?nivel=barrio
// Y para ver las guías del mapa y usar la cámara libre con la que se crean los planos de cámara:
//   http://localhost:3000/?nivel=barrio&depurar

import { crearEscenario } from '../src/index.ts';
import { Tortilleria } from './tortilleria.ts';

const NIVELES = {
  casa: '/niveles/casa/nivel.json',
  barrio: '/niveles/barrio/nivel.json',
};
const NIVEL_INICIAL = 'casa';

const elemento = document.querySelector<HTMLElement>('#juego');
const aviso = document.querySelector<HTMLElement>('#aviso');
if (elemento === null || aviso === null) {
  throw new Error('a la página de la demo le falta el elemento #juego o #aviso');
}

try {
  const juego = await crearEscenario(elemento, {
    niveles: NIVELES,
    nivel: leerNivelDeLaDireccion() ?? NIVEL_INICIAL,
    minijuegos: { Tortilleria },
    depurar: new URLSearchParams(location.search).has('depurar'),
    // Un host de verdad dibujaría aquí su barra de carga.
    alCargar: (progreso) => console.log(`cargando imágenes: ${progreso.cargados} de ${progreso.total}`),
  });
  // El motor avisa con eventos y el host decide qué hacer: aquí solo se muestran en la consola.
  juego.on('objetivo', (objetivo) => console.log('objetivo cumplido:', objetivo));
  juego.on('palabra', (palabra) => console.log('palabra vista:', palabra.en, '=', palabra.es));
  juego.on('guardar', (partida) => console.log('conviene guardar:', JSON.stringify(partida)));
  juego.on('cinematica', (cinematica) => console.log('cinemática:', cinematica.id, cinematica.fase));
  juego.on('minijuego', (minijuego) => console.log('minijuego:', minijuego.nombre, minijuego.fase));
  juego.on('estado', (estado) => console.log('cambió el estado:', JSON.stringify(estado.cambios)));
  juego.on('nivel', (cambio) => console.log('nivel:', cambio.id, '(antes:', cambio.anterior + ')'));
  juego.on('salida', (destino) => console.log('el jugador salió hacia:', destino));
  juego.on('error', (error) => console.error('el juego avisó de un error:', error.problemas));
  addEventListener('pagehide', () => juego.destruir());
} catch (error) {
  // Un nivel mal escrito se explica en la propia página: cada problema en su línea.
  const problemas = error instanceof Error && 'problemas' in error ? error.problemas : undefined;
  aviso.hidden = false;
  aviso.textContent = Array.isArray(problemas) ? problemas.join('\n') : String(error);
  console.error(error);
}

/** El nivel que pide la dirección de la página con `?nivel=...`, si es uno de los de la demo. */
function leerNivelDeLaDireccion(): string | undefined {
  const pedido = new URLSearchParams(location.search).get('nivel');
  if (pedido === null || !Object.hasOwn(NIVELES, pedido)) return undefined;
  return pedido;
}
