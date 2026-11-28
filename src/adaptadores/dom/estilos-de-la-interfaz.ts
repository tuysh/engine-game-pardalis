// La hoja de estilos de la interfaz del juego (globos, opciones, botón de inicio).
// Vive dentro de un «shadow root», así los estilos del host no la rompen ni ella rompe los del host.
//
// El host la personaliza con variables CSS puestas en el elemento del juego o en cualquiera de sus padres:
//   --escenario-fuente          tipo de letra
//   --escenario-color-globo     fondo de globos y tarjetas
//   --escenario-color-texto     texto y contornos
//   --escenario-color-acento    tarjeta de vocabulario y resaltados
//
// Todos los tamaños se multiplican por --escala, que el motor sube en el modo proyección (salón de clases).

export const ESTILOS_DE_LA_INTERFAZ = `
:host {
  position: absolute;
  inset: 0;
  overflow: hidden;
  /* La capa no estorba al escenario: solo reciben toques las piezas que lo piden. */
  pointer-events: none;
  --escala: 1;
  --fondo: var(--escenario-color-globo, #fffdf5);
  --tinta: var(--escenario-color-texto, #2b2118);
  --acento: var(--escenario-color-acento, #e2572b);
  font-family: var(--escenario-fuente, ui-rounded, 'Nunito', 'Trebuchet MS', system-ui, sans-serif);
  color: var(--tinta);
  -webkit-user-select: none;
  user-select: none;
}

[hidden] {
  display: none !important;
}

/* Capa invisible que atrapa el toque «para seguir» mientras alguien habla. */
.capa-de-toque {
  position: absolute;
  inset: 0;
  pointer-events: auto;
  cursor: pointer;
}

.globo {
  position: absolute;
  left: 0;
  top: 0;
  box-sizing: border-box;
  max-width: min(calc(520px * var(--escala)), calc(100% - 24px));
  padding: calc(14px * var(--escala)) calc(20px * var(--escala));
  border: calc(3px * var(--escala)) solid var(--tinta);
  border-radius: calc(22px * var(--escala));
  background: var(--fondo);
  /* Sombra dura y sin difuminar, como un recorte de papel sobre otro. */
  box-shadow: 0 calc(5px * var(--escala)) 0 rgb(0 0 0 / 22%);
  font-size: calc(26px * var(--escala));
  line-height: 1.25;
}

/* El piquito que apunta a quien habla: un cuadrito girado en el borde de abajo. */
.globo::after {
  content: '';
  position: absolute;
  left: calc(50% + var(--desvio-del-piquito, 0px));
  bottom: calc(-11px * var(--escala));
  width: calc(16px * var(--escala));
  height: calc(16px * var(--escala));
  border-right: calc(3px * var(--escala)) solid var(--tinta);
  border-bottom: calc(3px * var(--escala)) solid var(--tinta);
  background: var(--fondo);
  transform: translateX(-50%) rotate(45deg);
}

/* Lo que alguien piensa (no lo dice): una nube de bordes muy redondos y línea punteada... */
.globo.pensamiento {
  border-style: dashed;
  border-radius: calc(46px * var(--escala));
}

/* ...y en vez de piquito, dos burbujitas que bajan hacia quien piensa (la segunda es la sombra de la primera). */
.globo.pensamiento::after {
  bottom: calc(-16px * var(--escala));
  width: calc(12px * var(--escala));
  height: calc(12px * var(--escala));
  border: calc(3px * var(--escala)) solid var(--tinta);
  border-radius: 50%;
  transform: translateX(-50%);
  box-shadow:
    calc(-9px * var(--escala)) calc(13px * var(--escala)) 0 calc(-2px * var(--escala)) var(--fondo),
    calc(-9px * var(--escala)) calc(13px * var(--escala)) 0 calc(1px * var(--escala)) var(--tinta);
}

.traduccion {
  margin-top: calc(6px * var(--escala));
  font-size: 0.75em;
  font-style: italic;
  opacity: 0.75;
}

/* Tarjeta de vocabulario: la palabra en los dos idiomas, pegada arriba del globo. */
.tarjeta-de-palabra {
  position: absolute;
  left: calc(16px * var(--escala));
  bottom: calc(100% - 6px * var(--escala));
  padding: calc(4px * var(--escala)) calc(14px * var(--escala));
  border: calc(3px * var(--escala)) solid var(--tinta);
  border-radius: calc(14px * var(--escala));
  background: var(--acento);
  color: #ffffff;
  font-size: 0.85em;
  font-weight: 700;
  white-space: nowrap;
}

/* La flecha que señala la salida: apunta hacia abajo y sube y baja para llamar la atención. */
.flecha {
  position: absolute;
  left: 0;
  top: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: calc(4px * var(--escala));
}

.flecha svg {
  width: calc(64px * var(--escala));
  height: calc(64px * var(--escala));
  fill: var(--acento);
  stroke: var(--tinta);
  stroke-width: 1.5;
  stroke-linejoin: round;
  animation: subir-y-bajar 0.9s ease-in-out infinite alternate;
}

.leyenda-de-la-flecha {
  padding: calc(4px * var(--escala)) calc(14px * var(--escala));
  border: calc(3px * var(--escala)) solid var(--tinta);
  border-radius: calc(14px * var(--escala));
  background: var(--fondo);
  font-size: calc(22px * var(--escala));
  font-weight: 700;
  white-space: nowrap;
}

@keyframes subir-y-bajar {
  from {
    transform: translateY(calc(-14px * var(--escala)));
  }
  to {
    transform: translateY(0);
  }
}

/* El aviso de que hay algo a la mano: un globito pequeño sobre el personaje u objeto. */
.aviso {
  position: absolute;
  left: 0;
  top: 0;
}

.aviso svg {
  display: block;
  width: calc(44px * var(--escala));
  height: calc(44px * var(--escala));
  fill: var(--fondo);
  stroke: var(--tinta);
  stroke-width: 1.5;
  stroke-linejoin: round;
  animation: subir-y-bajar 0.7s ease-in-out infinite alternate;
}

/* El fundido a negro: una cortina que el motor va oscureciendo o aclarando. */
.fundido {
  position: absolute;
  inset: 0;
  background: #000000;
}

/* El destello: un flash blanco de toda la pantalla, como el de una cámara de fotos. */
.destello {
  position: absolute;
  inset: 0;
  background: #ffffff;
}

/* Las franjas de cine: una arriba y una abajo. La capa completa atrapa los toques durante la cinemática. */
.franjas {
  position: absolute;
  inset: 0;
  pointer-events: auto;
}

.franjas::before,
.franjas::after {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  /* El motor pone el alto según mundo.franjas del nivel (franjas-de-cine.ts). */
  height: var(--alto-de-la-franja, 9%);
  background: #000000;
}

.franjas::before {
  top: 0;
}

.franjas::after {
  bottom: 0;
}

.panel-de-saltar {
  position: absolute;
  right: calc(16px * var(--escala));
  bottom: calc(16px * var(--escala));
  pointer-events: auto;
}

.boton-de-saltar {
  width: calc(64px * var(--escala));
  height: calc(64px * var(--escala));
  padding: 0;
  border: calc(3px * var(--escala)) solid var(--tinta);
  border-radius: 50%;
  background: var(--fondo);
  cursor: pointer;
}

.boton-de-saltar svg {
  width: 55%;
  height: 55%;
  fill: var(--tinta);
}

.opciones {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: calc(14px * var(--escala));
  padding: calc(18px * var(--escala));
  pointer-events: auto;
}

.pregunta {
  max-width: 90%;
  padding: calc(10px * var(--escala)) calc(22px * var(--escala));
  border: calc(3px * var(--escala)) solid var(--tinta);
  border-radius: calc(20px * var(--escala));
  background: var(--fondo);
  box-shadow: 0 calc(5px * var(--escala)) 0 rgb(0 0 0 / 22%);
  font-size: calc(26px * var(--escala));
  text-align: center;
}

.tarjetas {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: calc(16px * var(--escala));
}

.tarjeta {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: calc(6px * var(--escala));
  box-sizing: border-box;
  width: calc(210px * var(--escala));
  max-width: 44vw;
  min-height: calc(150px * var(--escala));
  padding: calc(12px * var(--escala));
  border: calc(3px * var(--escala)) solid var(--tinta);
  border-radius: calc(20px * var(--escala));
  background: var(--fondo);
  box-shadow: 0 calc(6px * var(--escala)) 0 rgb(0 0 0 / 22%);
  color: inherit;
  font: inherit;
  font-size: calc(22px * var(--escala));
  cursor: pointer;
  transition: transform 0.12s;
}

.tarjeta img {
  width: calc(110px * var(--escala));
  height: calc(110px * var(--escala));
  object-fit: contain;
}

.tarjeta:active,
.tarjeta.resaltada {
  transform: scale(1.07);
  border-color: var(--acento);
  outline: calc(4px * var(--escala)) solid var(--acento);
}

/* El número de la tecla que elige la tarjeta. */
.numero-de-tarjeta {
  position: absolute;
  left: calc(8px * var(--escala));
  top: calc(6px * var(--escala));
  font-size: 0.7em;
  font-weight: 700;
  opacity: 0.55;
}

.inicio {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgb(0 0 0 / 35%);
  pointer-events: auto;
}

.boton-de-inicio {
  width: calc(150px * var(--escala));
  height: calc(150px * var(--escala));
  padding: 0;
  border: calc(5px * var(--escala)) solid var(--tinta);
  border-radius: 50%;
  background: var(--acento);
  box-shadow: 0 calc(8px * var(--escala)) 0 rgb(0 0 0 / 30%);
  cursor: pointer;
}

.boton-de-inicio svg {
  width: 55%;
  height: 55%;
  /* El triángulo se corre un poco a la derecha para que se vea centrado dentro del círculo. */
  margin-left: 8%;
  fill: #ffffff;
}

@media (prefers-reduced-motion: reduce) {
  .tarjeta {
    transition: none;
  }
  .flecha svg,
  .aviso svg {
    animation: none;
  }
  /* Con menos movimiento, el flash es más suave: un golpe de blanco total puede molestar. */
  .destello {
    background: rgb(255 255 255 / 55%);
  }
}
`;
