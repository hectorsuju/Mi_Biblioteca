# Mi Biblioteca

Web personal para llevar el registro de los libros que has leído, que estás leyendo y que quieres leer. Hecha en HTML, CSS y JavaScript puro, sin frameworks ni librerías externas.

## Archivos

- `index.html` — estructura de la página
- `styles.css` — todo el diseño visual
- `app.js` — toda la lógica (búsqueda, tarjetas, guardado)
- `books.json` — tu "base de datos" en formato JSON, con 3 libros de ejemplo

## Cómo funciona el guardado

No hay login ni servidor: los cambios que haces (añadir, editar, marcar como terminado, valorar) se guardan automáticamente en el **almacenamiento local del navegador** (`localStorage`), así que persisten aunque cierres y vuelvas a abrir la página en el mismo dispositivo y navegador.

Como pediste que la base de datos fuera un documento tipo JSON, la app incluye dos botones abajo a la izquierda:

- **Exportar**: descarga tu biblioteca completa como `books.json`, listo para guardar como copia de seguridad o subir de nuevo a Google Drive.
- **Importar**: carga un archivo `books.json` (por ejemplo, uno que hayas exportado antes) y sustituye los datos actuales.

Recomendación: exporta de vez en cuando y guarda ese `books.json` en tu carpeta de Google Drive como copia de seguridad de tu biblioteca.

## Cómo alojarla en Google Drive

Google Drive no ejecuta archivos HTML directamente (los abre como descarga, no como página web). Tienes dos opciones sencillas:

**Opción A — Uso local (la más simple):**
Guarda la carpeta completa (`index.html`, `styles.css`, `app.js`, `books.json`) sincronizada en tu Google Drive de escritorio, y haz doble clic en `index.html` para abrirla en el navegador cuando quieras usarla. Funciona sin conexión salvo para la búsqueda de libros y las recomendaciones (que sí necesitan internet).

**Opción B — Alojarla como web real (recomendado si quieres acceder desde el móvil):**
Sube estos mismos archivos a un hosting gratuito de páginas estáticas, por ejemplo GitHub Pages o Netlify, en un par de minutos y sin necesidad de saber programar. Así tendrás una URL fija a la que acceder desde cualquier dispositivo. Puedo ayudarte con estos pasos si quieres.

## La búsqueda de libros

Al pulsar el botón **+** y escribir un título, la app consulta la base de datos abierta de Open Library para autocompletar portada, autor, año y editorial. Es un servicio público gratuito, no una librería de código: no hace falta instalar nada.

Si no encuentra el libro, puedes rellenar los campos a mano y usar el botón **📷 Añadir foto** para subir o hacer una foto de la portada desde el móvil.

## Las recomendaciones del estante

El banner superior busca automáticamente otros libros de los mismos autores que tus libros mejor valorados (4-5 estrellas). Si aún no has valorado nada, usa el conjunto completo de tu biblioteca como referencia.
