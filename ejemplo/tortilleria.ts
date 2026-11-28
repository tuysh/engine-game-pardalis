// Minijuego de ejemplo: voltear las tortillas del comal.
// Muestra cómo se escribe un minijuego para el motor: es una función que recibe un elemento de la página
// a pantalla completa, dibuja lo que quiera dentro y devuelve una promesa con el resultado.
//
// Reglas de Pardalis que respeta:
// - Nada requiere leer: se juega tocando dibujos, y cada tortilla dice una palabra en voz alta.
// - Nunca castiga: no se puede perder. El botón de salir solo termina sin éxito, y el nivel responde amable.
//
// Doña Tortu acompaña desde un lado: parpadea con `assets.animar` y mueve la boca (`cambiar`) mientras dice
// cada palabra. Sus cuadros y su ritmo están en `niveles/barrio/assets.config.json`.
//
// El vapor que sube del comal se mueve con `enCadaCuadro`, el reloj del juego: si el host pausa el juego (o la
// página deja de verse), el vapor se queda quieto, igual que la pausa antes de terminar.

import type { Minijuego } from '../src/index.ts';

const TORTILLAS_POR_VOLTEAR = 3;
const PAUSA_ANTES_DE_TERMINAR_EN_SEGUNDOS = 0.9;
/** Cuánto sube el vapor antes de empezar otra vez desde el comal, y qué tan rápido. */
const ALTURA_DEL_VAPOR_EN_PUNTOS = 90;
const VELOCIDAD_DEL_VAPOR_EN_PUNTOS_POR_SEGUNDO = 45;
const COLOR_DE_TORTILLA_CRUDA = '#f6e3b0';
const COLOR_DE_TORTILLA_LISTA = '#d9a253';

export const Tortilleria: Minijuego = ({ elemento, config, audio, assets, senal, enCadaCuadro }) => {
  return new Promise((terminar) => {
    const palabras = leerPalabras(config);
    let tortillasVolteadas = 0;

    elemento.style.cssText =
      'display:flex; flex-direction:column; align-items:center; justify-content:center; gap:32px; background:#3a2a1a;';

    // El comal: un círculo oscuro con las tortillas encima (y el vapor, que se coloca respecto a él).
    const comal = document.createElement('div');
    comal.style.cssText =
      'position:relative; display:flex; gap:24px; padding:48px 56px;' +
      ' border-radius:50%; background:#555; border:10px solid #2b2b2b;';

    // Doña Tortu: una imagen que se anima sola, quieta y parpadeando, hasta que habla.
    const tortu = document.createElement('img');
    tortu.alt = '';
    tortu.style.cssText = 'height:220px;';
    const tortuAnimada = assets.animar(tortu, 'tortu_quieta');
    // Se precargan sus cuadros: así el primer parpadeo y la primera vez que habla no esperan a la red.
    for (const clave of ['tortu_quieta', 'tortu_habla']) {
      for (const direccion of new Set(assets.cuadros(clave).urls)) {
        new Image().src = direccion;
      }
    }

    for (let i = 0; i < TORTILLAS_POR_VOLTEAR; i++) {
      const tortilla = document.createElement('button');
      tortilla.type = 'button';
      tortilla.setAttribute('aria-label', 'Voltear la tortilla');
      tortilla.style.cssText = `width:110px; height:110px; border-radius:50%; border:6px solid #b98a45; background:${COLOR_DE_TORTILLA_CRUDA}; cursor:pointer;`;

      tortilla.addEventListener(
        'click',
        () => {
          tortilla.style.background = COLOR_DE_TORTILLA_LISTA;
          tortilla.disabled = true;
          tortillasVolteadas++;
          // Cada tortilla dice una de las palabras del nivel, en inglés.
          const palabra = palabras[i % palabras.length];
          if (palabra !== undefined) {
            // No se espera a que termine de decirla: se puede voltear otra tortilla mientras tanto.
            void decirMoviendoLaBoca(palabra);
          }
          if (tortillasVolteadas === TORTILLAS_POR_VOLTEAR) {
            terminarConExito();
          }
        },
        { signal: senal },
      );
      comal.append(tortilla);
    }

    // Salir sin terminar: un botón con una X, que no necesita texto.
    const salir = document.createElement('button');
    salir.type = 'button';
    salir.textContent = '✕';
    salir.setAttribute('aria-label', 'Salir');
    salir.style.cssText =
      'position:absolute; top:16px; right:16px; width:64px; height:64px; border-radius:50%; border:4px solid #2b2b2b; background:#fffdf5; font-size:32px; cursor:pointer;';
    salir.addEventListener('click', () => terminar({ exito: false }), { signal: senal });

    // El vapor: un óvalo blanco que sube del comal y se desvanece, una y otra vez. No se toca ni se lee: es
    // decorado. Va encima del comal y fuera del acomodo, para no empujar las tortillas fuera de una pantalla baja.
    const vapor = document.createElement('div');
    vapor.style.cssText =
      'position:absolute; left:50%; top:-40px; width:60px; height:30px; margin-left:-30px;' +
      ' border-radius:50%; background:#fffdf5; pointer-events:none;';
    let alturaDelVapor = 0;
    enCadaCuadro((segundos) => {
      const alturaNueva = alturaDelVapor + VELOCIDAD_DEL_VAPOR_EN_PUNTOS_POR_SEGUNDO * segundos;
      alturaDelVapor = alturaNueva % ALTURA_DEL_VAPOR_EN_PUNTOS;
      vapor.style.transform = `translateY(${-alturaDelVapor}px)`;
      vapor.style.opacity = String(1 - alturaDelVapor / ALTURA_DEL_VAPOR_EN_PUNTOS);
    });

    comal.append(vapor);
    elemento.append(tortu, comal, salir);

    // Cuántas frases se han empezado: solo la última devuelve a Doña Tortu a su pose quieta.
    let frasesEmpezadas = 0;

    /**
     * Doña Tortu mueve la boca mientras dice la palabra. Si otra palabra corta esta, la que la cortó es la que
     * después la deja quieta: así no se queda callada moviendo la boca, ni quieta mientras habla.
     */
    async function decirMoviendoLaBoca(palabra: string): Promise<void> {
      frasesEmpezadas++;
      const estaFrase = frasesEmpezadas;
      tortuAnimada.cambiar('tortu_habla');
      // Sin voz grabada (`undefined`), pero con la voz de Doña Tortu de `meta.personajes`, como en sus líneas.
      await audio.decir(palabra, 'en', undefined, 'tortu');
      if (estaFrase === frasesEmpezadas) {
        tortuAnimada.cambiar('tortu_quieta');
      }
    }

    function terminarConExito(): void {
      // Una pausa corta para que se vea la última tortilla volteada antes de volver al nivel. Se cuenta con el
      // reloj del juego: con el juego en pausa, la pausa también espera. Al cerrarse el minijuego, se deja sola.
      let segundosQueFaltan = PAUSA_ANTES_DE_TERMINAR_EN_SEGUNDOS;
      const dejarDeContar = enCadaCuadro((segundos) => {
        segundosQueFaltan -= segundos;
        if (segundosQueFaltan > 0) return;
        dejarDeContar();
        terminar({ exito: true, otorgar: { tortillas: true } });
      });
    }
  });
};

/** `config` viene del nivel y puede traer cualquier cosa: se revisa antes de usarla. */
function leerPalabras(config: unknown): string[] {
  const palabras: string[] = [];
  if (typeof config !== 'object' || config === null || !('palabras' in config)) return palabras;
  if (!Array.isArray(config.palabras)) return palabras;

  for (const palabra of config.palabras) {
    if (typeof palabra === 'string') {
      palabras.push(palabra);
    }
  }
  return palabras;
}
