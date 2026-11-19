// Guarda las texturas ya hechas, por la dirección de su archivo, para que cada imagen se descargue
// y se convierta una sola vez aunque se use en varios lugares (un personaje que cambia de dibujo
// y luego vuelve al suyo, una animación que se repite en dos escenas).
//
// Las texturas son del almacén: las piezas del escenario las usan pero no las liberan.
// Entre un nivel y otro se conservan las que el nivel nuevo también usa y se libera el resto
// (docs/DISENO-3.0.md §8.4): `empezarOtroLugar()` al montar, y `liberarLasQueSobran()` cuando ya cargó.

import type { Texture } from 'three';
import type { ImagenDeEscena } from '../../puertos/escenario.ts';
import { cargarTextura } from './texturas.ts';
import type { FabricaDeTexturas } from './texturas.ts';

export class AlmacenDeTexturas {
  private readonly fabrica: FabricaDeTexturas;
  /** La textura de cada archivo, por su dirección. Se guarda la promesa para no descargar dos veces a la vez. */
  private readonly texturas = new Map<string, Promise<Texture>>();
  /** Las direcciones que se han pedido desde que empezó el lugar actual. */
  private readonly usadasEnEsteLugar = new Set<string>();

  constructor(fabrica: FabricaDeTexturas) {
    this.fabrica = fabrica;
  }

  /** Las texturas de una imagen, una por cuadro (una imagen fija tiene una sola). Descarga las que falten. */
  async cargar(imagen: ImagenDeEscena): Promise<Texture[]> {
    const pendientes: Promise<Texture>[] = [];
    for (const direccion of imagen.direcciones) {
      this.usadasEnEsteLugar.add(direccion);
      let textura = this.texturas.get(direccion);
      if (textura === undefined) {
        textura = cargarTextura(direccion, imagen, this.fabrica);
        this.texturas.set(direccion, textura);
        // Si la descarga falla, no se guarda el error: la próxima vez se intenta otra vez.
        textura.catch(() => this.texturas.delete(direccion));
      }
      pendientes.push(textura);
    }
    return Promise.all(pendientes);
  }

  /** Se llama al montar otro lugar: desde aquí se vuelve a anotar qué texturas se usan. */
  empezarOtroLugar(): void {
    this.usadasEnEsteLugar.clear();
  }

  /** Libera las texturas que el lugar actual no ha pedido. Se llama cuando el lugar ya terminó de cargar. */
  liberarLasQueSobran(): void {
    for (const direccion of [...this.texturas.keys()]) {
      if (!this.usadasEnEsteLugar.has(direccion)) {
        this.liberar(direccion);
      }
    }
  }

  /** Libera todas las texturas. Se llama al destruir el escenario. */
  liberarTodas(): void {
    for (const direccion of [...this.texturas.keys()]) {
      this.liberar(direccion);
    }
    this.usadasEnEsteLugar.clear();
  }

  private liberar(direccion: string): void {
    const textura = this.texturas.get(direccion);
    this.texturas.delete(direccion);
    if (textura === undefined) return;
    // Una textura que no llegó a cargar no tiene nada que liberar: su error ya lo recibió quien la pidió.
    textura.then(
      (texturaCargada) => texturaCargada.dispose(),
      () => {},
    );
  }
}
