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
  /** A quién avisar cada vez que un archivo pedido termina de cargar. */
  private funcionesDeCarga: (() => void)[] = [];

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
      // Se avisa de cada archivo pedido cuando ya está listo, también si estaba guardado de antes.
      // Si no cargó, no se avisa: su error ya lo recibe quien lo pidió.
      textura.then(
        () => this.avisarDeUnArchivoCargado(),
        () => {},
      );
    }
    return Promise.all(pendientes);
  }

  /** Avisa cada vez que termina de cargar un archivo pedido con `cargar`. Devuelve una función que deja de avisar. */
  alCargarUnArchivo(funcion: () => void): () => void {
    this.funcionesDeCarga.push(funcion);
    return () => {
      this.funcionesDeCarga = this.funcionesDeCarga.filter((registrada) => registrada !== funcion);
    };
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

  private avisarDeUnArchivoCargado(): void {
    // Se recorre una copia porque quien escucha puede darse de baja mientras se le avisa.
    for (const funcion of [...this.funcionesDeCarga]) {
      funcion();
    }
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
