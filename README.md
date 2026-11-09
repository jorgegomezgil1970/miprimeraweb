# ❄ Calendario de Adviento 3D — "Invierno mágico"

Un regalo personal: un árbol de Navidad en 3D rodeado de 24 regalos numerados. Cada día de diciembre se desbloquea uno nuevo con un mensaje, una foto, una ilustración y un pequeño objeto 3D giratorio.

Hecho solo con **HTML, CSS y JavaScript** (sin frameworks ni npm). El 3D usa [Three.js](https://threejs.org/) desde CDN; las ilustraciones son SVG generados por código y la música y los sonidos se sintetizan con la Web Audio API.

## Cómo abrirlo

Haz **doble clic en `index.html`**: se abre en el navegador y funciona tal cual, sin servidor ni instalaciones.

> Hace falta conexión a internet para descargar Three.js y las tipografías de Google Fonts.

Para el **modo prueba** añade `?test=1` al final de la dirección que aparece en el navegador (por ejemplo `…/index.html?test=1`) y pulsa Intro.

Para regalarlo puedes enviar la carpeta comprimida en un zip, o publicarla gratis en GitHub Pages, Netlify o Vercel subiendo la carpeta tal cual.

### ¿Por qué funciona con doble clic?

Los archivos de `js/` son scripts clásicos que comparten datos mediante variables globales (`window.CONFIG`, `window.audio`…). Solo Three.js se carga como módulo desde el CDN, y eso sí está permitido al abrir el archivo directamente.

## Personalizarlo

Todo se edita en **`js/data.js`**:

| Campo | Qué es |
|---|---|
| `recipientName` | Nombre de la persona (portada y cabecera). |
| `dedication` | Dedicatoria de la portada. |
| `signature` | Firma bajo la dedicatoria (`''` para ocultarla). |
| `days[n].title` | Título del día. |
| `days[n].message` | Mensaje personal (usa `\n` para saltos de línea). |
| `days[n].photo` | Ruta de la foto, p. ej. `assets/photos/dia05.jpg`. |

Las fotos van en `assets/photos/` con los nombres `dia01.jpg` … `dia24.jpg` (ver `assets/photos/README.md`). Si falta alguna, se muestra un marco decorativo.

## Cómo funciona el desbloqueo

- Usa la fecha y hora local del dispositivo.
- Del 1 al 24 de diciembre: el día *N* se puede abrir a partir del *N* de diciembre.
- Desde el 25 de diciembre (y durante enero) todo está abierto. El resto del año todo está bloqueado.
- Los regalos abiertos se guardan en `localStorage` y siguen abiertos al volver.

### Modo prueba

Añade `?test=1` a la URL (p. ej. `…/index.html?test=1`). Se desbloquea todo y aparece un pequeño panel abajo a la izquierda (botón ⚙) para:
- activar o desactivar "Desbloquear todo",
- simular una fecha concreta,
- reiniciar el progreso guardado.

## Estructura

```
index.html
css/styles.css
js/main.js            escena 3D, regalos, interacción, modal y lógica principal
js/data.js            ← configuración editable de los 24 días
js/audio.js           música y efectos (Web Audio API)
js/illustrations.js   24 ilustraciones SVG generadas por código
js/dayObjects.js      24 objetos 3D del mini visor (solo geometrías de Three.js)
assets/photos/        tus fotos (dia01.jpg … dia24.jpg)
```

## Controles

- **Ratón:** arrastra para girar, rueda para zoom, clic en un regalo para abrirlo.
- **Táctil:** arrastra con un dedo para girar, pellizca para zoom, toca un regalo para abrirlo.
- El botón del altavoz (arriba a la derecha) silencia o activa el sonido, y la preferencia se recuerda.
- En la cabecera, el botón "Hoy puedes abrir el regalo N" lleva la cámara hasta el regalo del día.
