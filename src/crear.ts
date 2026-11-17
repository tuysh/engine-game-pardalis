// `crearEscenario()`: la única puerta de entrada del motor en el navegador (docs/DISENO-3.0.md §4).
// Es la raíz de composición: el único lugar que crea los adaptadores del navegador y se los entrega a la aplicación.
//
// Estado: carga y valida un nivel, lo dibuja y deja caminar al jugador tocando el piso.
// Todavía no usa `partida`, `cinematicas`, `idioma`, `iniciarCon`, `alCargar`, `depurar` ni `semilla`,
// y los minijuegos solo se usan para validar que el nivel los nombre bien. Cada cosa llega en su fase (§13).

import { crearLienzo, leerDensidadDePantalla } from './adaptadores/dom/crear-lienzo.ts';
import { RelojDelNavegador } from './adaptadores/dom/reloj-del-navegador.ts';
import { LectorDeNivelesDeJson } from './adaptadores/json/lector-de-niveles-de-json.ts';
import { CargadorDeRed } from './adaptadores/red/cargador-de-red.ts';
import { EscenarioDeThree } from './adaptadores/three/escenario-de-three.ts';
import { LectorDeMapasDeTiled } from './adaptadores/tiled/lector-de-mapas-de-tiled.ts';
import { jugarNivel } from './aplicacion/jugar-nivel.ts';
import type { NivelEnJuego } from './aplicacion/jugar-nivel.ts';
import { validarNivel } from './aplicacion/validar-nivel.ts';
import { ErrorDeEscenario } from './dominio/error-de-escenario.ts';
import type { Juego } from './juego.ts';
import { JuegoCreado } from './juego-creado.ts';
import type { OpcionesDeEscenario } from './opciones-de-escenario.ts';

/**
 * Crea el juego dentro de `elemento`, ocupando todo su tamaño.
 * La promesa termina cuando el nivel ya se puede jugar y rechaza con `ErrorDeEscenario`
 * si no pudo arrancar; `error.problemas` trae un mensaje por problema.
 */
export async function crearEscenario(elemento: HTMLElement, opciones: OpcionesDeEscenario): Promise<Juego> {
  revisarQueNoSeCancelo(opciones);

  const cargador = new CargadorDeRed(opciones.origenesPermitidos ?? []);
  const direccionDelNivel = buscarDireccionDelNivel(opciones);
  const pedido = {
    direccionDelNivel,
    minijuegos: Object.keys(opciones.minijuegos ?? {}),
    raizDeAssets: opciones.raizDeAssets,
  };
  const lectores = { cargador, lector: new LectorDeNivelesDeJson(), lectorDeMapas: new LectorDeMapasDeTiled() };

  const resultado = await validarNivel(pedido, lectores);
  for (const advertencia of resultado.advertencias) {
    console.warn(`[escenario-engine] ${advertencia}`);
  }
  if (resultado.nivel === undefined) {
    throw new ErrorDeEscenario(resultado.errores);
  }
  revisarQueNoSeCancelo(opciones);

  const reloj = new RelojDelNavegador();
  const escenario = crearEscenarioDeThree(elemento);
  let nivelEnJuego: NivelEnJuego;
  try {
    const ubicacion = { direccionDelNivel, raizDeAssets: opciones.raizDeAssets, cargador };
    nivelEnJuego = await jugarNivel(resultado.nivel, ubicacion, { escenario, reloj });
    revisarQueNoSeCancelo(opciones);
  } catch (error) {
    // Si algo falla o se cancela a medio armar, no se deja nada montado en la página.
    reloj.detener();
    escenario.destruir();
    throw error;
  }

  return new JuegoCreado({
    idDelNivel: resultado.nivel.contenido.meta.id,
    escenario,
    reloj,
    nivelEnJuego,
    proyeccion: opciones.proyeccion ?? false,
  });
}

/** `opciones.nivel` es un id de `opciones.niveles` o, si no está ahí, directamente la dirección de un `nivel.json`. */
function buscarDireccionDelNivel(opciones: OpcionesDeEscenario): string {
  const niveles = opciones.niveles ?? {};
  if (Object.hasOwn(niveles, opciones.nivel)) {
    return niveles[opciones.nivel]!; // `hasOwn` acaba de comprobar que existe
  }
  return opciones.nivel;
}

function crearEscenarioDeThree(elemento: HTMLElement): EscenarioDeThree {
  try {
    return new EscenarioDeThree(elemento, { crearLienzo, densidadDePantalla: leerDensidadDePantalla() });
  } catch (error) {
    const detalle = error instanceof Error ? error.message : String(error);
    throw new ErrorDeEscenario([`el navegador no pudo preparar el lienzo 3D (WebGL): ${detalle}`]);
  }
}

/** Si el host canceló la creación con `opciones.senal`, lanza el motivo de la cancelación. */
function revisarQueNoSeCancelo(opciones: OpcionesDeEscenario): void {
  if (opciones.senal !== undefined) {
    opciones.senal.throwIfAborted();
  }
}
