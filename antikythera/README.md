# Antikythera Rings

Antikythera Rings is a browser-based astronomical display inspired by the Antikythera mechanism. It renders planetary rings, a timezone-aware date/time control panel, and a draconic lunar node pointer.

## What It Shows

- Moon, Mercury, Venus, Sun, Mars, Jupiter, and Saturn ecliptic longitudes.
- A draconic pointer for the lunar ascending and descending nodes.
- A zodiac/constellation background.
- A readout of current planetary angles and node longitude.

The astronomical calculations use the bundled JavaScript build of [cosinekitty/astronomy](https://github.com/cosinekitty/astronomy).

## Use

Open:

```text
antikythera/index.html
```

The page runs as static HTML/CSS/JavaScript. No build step is required.

## Controls

- `Date/Time`: enter a local date/time for the selected timezone.
- Timezone selector: choose one of 24 representative world timezones.
- Slider: move across roughly 100 years before or after the launch date.
- `Now`: return to the current date/time.
- `+/- 1 Day`: step by one day.
- `+/- 1 Week`: step by one week.
- `+/- 1 Month`: step by one month.
- `+/- 1 Year`: step by one year.

## Project Structure

```text
antikythera/
+-- index.html
+-- style.css
+-- app.js
+-- README.md
+-- Rings/
+-- vendor/
    +-- astronomy.browser.min.js
```

## Current Status

- Browser version is active.
- Timezone-aware input is implemented.
- Lunar node pointer is implemented using Astronomy Engine moon node APIs.
- Mobile controls are supported.

## Authors

Evangelos Papadopoulos and Gerasimos Papadopoulos.

Contact: evangelos.papadopoulos@gmail.com

## Planning

See the repository-level [ROADMAP.md](../ROADMAP.md).

## License

This project follows the repository dual licensing model:

- Open-source use: [GPLv3](../GPL-3.0.txt).
- Commercial/proprietary licensing: available separately from Evangelos Papadopoulos and Gerasimos Papadopoulos.

See [LICENSE](../LICENSE), [license.html](../license.html), and [COMMERCIAL_LICENSE.md](../COMMERCIAL_LICENSE.md).
