# Gerasim Projects

This GitHub Pages repository hosts a small project landing page with links to the available browser projects.

## Site Structure

```text
gerasimpapa.github.io/
+-- index.html
+-- tetrada/
|   +-- index.html
|   +-- tetrada.html
|   +-- tetrada_mirror.html
|   +-- tetrada_preview.html
|   +-- tetrada_autoplay.html
|   +-- Z_test.html
|   +-- styles.css
|   +-- game.js
|   +-- game_mirror.js
|   +-- game_preview.js
|   +-- game_autoplay.js
|   +-- game_z_only.js
+-- antikythera/
    +-- index.html
    +-- style.css
    +-- app.js
    +-- README.md
    +-- Rings/
    +-- vendor/
```

## Pages

- Root landing page: `index.html`
- Tetrada menu: `tetrada/index.html`
- Antikythera Rings: `antikythera/index.html`

## Tetrada

`tetrada/` contains the Tetrada game variants:

- Classic
- Mirror
- Preview Lab
- Autoplay
- Z Piece Test

All Tetrada HTML files use `tetrada/styles.css` and their matching JavaScript file in the same folder.

## Antikythera

`antikythera/` contains the Antikythera ring display. It loads ring images from `antikythera/Rings/` and uses the bundled Astronomy Engine browser build from `antikythera/vendor/`.
