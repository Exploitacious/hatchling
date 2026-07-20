# Noto Color Emoji (COLRv1)

Vendored from Google Fonts (v39), OFL-1.1 licensed (see LICENSE). This is the
**COLRv1** build — the flavor Chromium/Electron renders natively.

Do not replace with the SVG-in-OpenType build (`glyf` + `SVG ` tables, e.g. the
`@fontsource/noto-color-emoji` package): Chromium does not support SVG-in-OT
color fonts and silently renders blank/tofu glyphs. Verify any update with
`fonttools`: the files must contain `COLR` (version 1) + `CPAL` tables.
