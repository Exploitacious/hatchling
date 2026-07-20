# Noto Color Emoji (CBDT bitmap build)

Vendored from googlefonts/noto-emoji (`fonts/NotoColorEmoji.ttf`, OFL-1.1 — see
LICENSE), compressed to woff2 with fonttools.

Why this flavor, learned the hard way (twice):

- **SVG-in-OpenType** (`glyf` + `SVG ` tables — what `@fontsource/noto-color-emoji`
  ships): Chromium has never supported it. Renders blank/tofu.
- **COLRv1** (`COLR` v1 + `CPAL`): renders in Chromium's software path, but drew
  *invisible* glyphs on WSLg's GPU raster path in the field (copy-paste worked,
  nothing painted).
- **CBDT/CBLC** (this file): embedded bitmaps — no vector-paint pipeline to
  break. The flavor Android/ChromeOS ship. Renders identically with and without
  GPU (pixel-verified in Electron under xvfb both ways).

Any replacement must contain `CBDT` + `CBLC` tables (check with fonttools) and
be pixel-verified in Electron on a machine with no system emoji fonts.
