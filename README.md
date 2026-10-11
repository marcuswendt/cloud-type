# Cloud Type (Cascade)

Dotted cloud type as a Cascade graph: a headline (or an image) to plotter dots, with the Human First book's focus and blown dots. A port of the standalone app at `~/Documents/Dev/cloud-type`, itself a port of cloud-plots' `titletype` / `titlepage`. The generator's maths is unchanged, so the graph's dots are identical to the app's.

## Graph

`cloud-type.cascade`, left to right:

| Stage | Node | Out |
| --- | --- | --- |
| Spec | `spec` | bundle `spec`: capMm, pitchMm (cap / 34 clamped 0.28-0.6, / density, or explicit), seed, penMm, quality |
| Source (subnet) | `type-set` → `outline-mask`; `image-mask`; `cascade.core.Switch` picks one | `type-set` gives the glyph outlines as closed polygons (mm, inspect as wireframe); the subnet gives a `cloudtype.mask` |
| Stipple | `stipple` | points (mm) with `t` (tone) and `comp` (letter) |
| Look | `look` | bundle `look`: defocus, fade, dof, span, tone. With *use strength* on, `titlepage.between(strength)` (0 = 1C, 1 = soft); off, by hand |
| Focus | `focus` | points after the lens: radial / tilt / swept / hunt, disc / ring / cat's-eye bokeh, rings, ghost, shrink, reticle, focus scale |
| Finish (subnet) | `dot-scale` → `blow` → `pen-sizes` → `thin` | points with `size` (mm, quarter-pen steps) and `blown` |
| Page | `page` | points in page mm, detail `pageMm` (fit with a margin, or a custom page and text origin) |
| Outputs | `plot-svg`, `preview-svg`, `png`, fed colour and ground by `style` | plotter SVG (layers 1/2/3 by size or one 0 title), filled preview SVG (the viewer), PNG at 150-1200 dpi |

Geometry on the wires is +Y up (Cascade's convention); the generator works y-down and `lib/cloudtype/geo.ts` flips at the boundary. The graph's defaults are the approved CLOUD OBSERVATORY (`APPROVED_T` = 0.1).

The `editor` section publishes every control of the standalone app (groups Input, Focus, Blown dots, Dots, Colour and page, Export), its four presets, the three outputs and the shippable assets.

## Fonts

Inter Display Medium (SIL Open Font License, `assets/fonts/Inter-OFL-LICENSE.txt`) is the default and the only font in this repo. The book is set in Helvetica Now Display Medium, licensed to FIELD for two desktop seats: it is never copied, committed, bundled or exported. Every `licensed/` directory is gitignored. Drop the licensed OTF into the `font` parameter on a licensed machine; parity reads it in place from cloud-plots.

## Commands

```sh
npm install
npm test               # tsc, cascade check, cascade validate, cascade run
npx --no-install cascade run cloud-type.cascade --frames 1    # renders/png.0001.png
./scripts/parity.sh    # graph vs standalone vs cloud-plots, into export/parity/
```

`scripts/parity-dots.ts <preset> <out.json> [font.otf]` runs the graph through Cascade's runtime with a preset from the editor section and writes the page dots in the standalone's `scripts/dots.ts` shape; `scripts/compare-dots.ts a.json b.json` compares two such files. `parity.sh` needs the standalone checkout, the cloud-plots venv and the licensed font where cloud-plots keeps it.
