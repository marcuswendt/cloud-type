# Cloud Type (Cascade)

Dotted cloud type for the Human First book: a headline (or an image) becomes plotter dots, with the book's focus falloff and blown dots. It is a [Cascade](vendor/) project: the whole generator is one node graph, `cloud-type.cascade`, which runs in Cascade Studio, under the `cascade` CLI and as a shareable browser editor (https://cloud-type.vercel.app, FIELD Vercel login).

FIELD internal use. See `LICENSE`.

## Setup

Needs Node 22.13 or newer.

```sh
git clone https://github.com/marcuswendt/cloud-type.git
cd cloud-type
npm install
npm test        # type check, graph check, validate, one run
```

Cascade is not on npm: it is vendored as `vendor/field-cascade-0.9.1.tgz` and installed from there (`"cascade": "file:vendor/…"` in `package.json`). Nothing else is needed. To move to a newer Cascade, someone with the Cascade source runs `npm run vendor:cascade -- <path to cascade checkout>` and commits the new tarball.

## Run Studio

```sh
npm run dev                         # Studio on the graph, opens a browser
npm run dev -- --port 4100 --no-open
```

Studio shows the graph left to right. Select a node to edit its props in the Inspector; outputs re-cook as you change them. The viewer shows the selected output (the filled preview SVG is the one to look at).

## Edit and publish parameters

The `editor` section of `cloud-type.cascade` decides what the browser editor shows: the published parameters, their groups, the presets, the outputs and the assets.

- **In Studio:** the `share` toggle beside a prop in the Inspector publishes it, with label, group and range fields. Save the graph.
- **On the command line:** `npx cascade publish cloud-type.cascade spec.capMm --label "Cap height" --group Input --min 3 --max 60 --unit mm`
- **Presets, outputs, help text and `visibleWhen`** are edited in the JSON (`editor.presets`, `editor.outputs`).

Changing a default in Studio changes what the editor opens with. Rewiring the graph or renaming a published parameter changes the graph version, so older scene files open with a warning (values still apply where they match).

## Export the editor

```sh
npm run export:plan        # what would ship: nodes, parameters, assets
npm run export             # writes the static editor to export/site/
npx serve export/site      # or any static server, to try it locally
```

`export/` is gitignored. The export refuses to ship licensed fonts, local paths and secrets.

To redeploy https://cloud-type.vercel.app (Vercel team field-io, Vercel Authentication stays on):

```sh
npx cascade export cloud-type.cascade --out export/site --deploy vercel --project cloud-type --scope field-io
```

## Scene files

A scene (`*.scene.json`) holds the values of the published parameters, nothing else. `scenes/` has the two book headlines:

| File | What |
| --- | --- |
| `scenes/cloud-observatory-final.scene.json` | CLOUD OBSERVATORY, final (the approved title) |
| `scenes/cloud-observatory-1c-halfway.scene.json` | CLOUD OBSERVATORY, 1C-halfway |
| `scenes/in-search-of-a-longer-now-1c.scene.json` | IN SEARCH OF A LONGER NOW, exactly 1C |

- **Browser editor:** "Save scene" downloads one, "Open scene…" (or drop the file on the viewer) loads one.
- **Studio:** File › Open Scene… applies a scene as an unsaved edit; File › Save Scene… writes one.
- **CLI:** `npx cascade scene cloud-type.cascade scenes/x.scene.json --out x.cascade` writes a copy of the graph with the scene applied.

Fonts and images in a scene are matched by name and hash. A file up to 2 MB is embedded; a licensed font never should be, so put it on your machine (see Fonts) and the scene finds it by name.

## Render a headline to PNG or SVG

```sh
mkdir -p out   # out/ is gitignored; --write does not create folders

# plotter SVG (mm, pen paths in layers 1/2/3 by dot size) and a PNG
npx cascade run cloud-type.cascade --scene scenes/in-search-of-a-longer-now-1c.scene.json \
  --write plot-svg.svg=out/longer-now-plot.svg --write png.image=out/longer-now.png

# filled preview SVG
npx cascade run cloud-type.cascade --scene scenes/cloud-observatory-final.scene.json \
  --write preview-svg.svg=out/cloud-observatory-preview.svg
```

For a new headline: open a scene in the editor or Studio, change `text` (and cap height, indents, focus centre), save the scene, then run the line above with it. `plot-svg` is the file for the plotter; `png` takes `dpi` (150-1200) and `pngGround` from the scene.

## Graph

`cloud-type.cascade`, left to right:

| Stage | Node | Out |
| --- | --- | --- |
| Spec | `spec` | bundle `spec`: capMm, pitchMm (cap / 34 clamped 0.28-0.6, / density, or explicit), seed, penMm, quality |
| Source (subnet) | `type-set` → `outline-mask`; `image-mask`; `cascade.core.Switch` picks one | `type-set` gives the glyph outlines as closed polygons (mm, inspect as wireframe); the subnet gives a `cloudtype.mask` |
| Stipple | `stipple` | points (mm) with `t` (tone) and `comp` (letter) |
| Express | `express` | points after the type expression (regularity, weight, dissolve, letters, motion); `comp` kept and updated. Every default is the identity |
| Look | `look` | bundle `look`: defocus, fade, dof, span, tone. With *use strength* on, `titlepage.between(strength)` (0 = 1C, 1 = soft); off, by hand |
| Focus | `focus` | points after the lens: radial / tilt / swept / hunt / bokeh, disc / ring / cat's-eye bokeh, rings, ghost, shrink, reticle, focus scale |
| Finish (subnet) | `dot-scale` → `blow` → `pen-sizes` → `thin` | points with `size` (mm, quarter-pen steps) and `blown` |
| Page | `page` | points in page mm, detail `pageMm` (fit with a margin, or a custom page and text origin) |
| Outputs | `plot-svg`, `preview-svg`, `png`, fed colour and ground by `style` | plotter SVG (layers 1/2/3 by size or one 0 title), filled preview SVG (the viewer), PNG at 150-1200 dpi |

Geometry on the wires is +Y up (Cascade's convention); the generator works y-down and `lib/cloudtype/geo.ts` flips at the boundary. The graph's defaults are the approved CLOUD OBSERVATORY, `final` (cloud-plots 152a124: 30% from 1C toward soft, radial at 0.35, 0.5). 1C-halfway is kept as a preset.

Presets (in the editor's preset menu): `co-approved` is **final**, the approved CLOUD OBSERVATORY (30% of the way from 1C toward soft); `co-halfway` is 1C-halfway; `isolon-approved` is IN SEARCH OF A LONGER NOW, exactly 1C; `co-1c` and `co-soft` are the two ends.

The `editor` section publishes every control of the standalone app (groups Input, Expression, Focus, Blown dots, Dots, Colour and page, Export), its four presets, the three outputs and the shippable assets.

## Expression

The `express` node (the editor's Expression group) ports cloud-plots' `typeexpr.express` line for line, so each headline can be crafted rather than given one uniform effect. It sits between the stipple and the focus and works on the dots alone: *grid* pulls dots onto a hexagonal lattice (past 0.5 one dot per node) and *jitter* scatters them; *size variation* spreads dot sizes; *weight* makes the letters' cores heavier and *stack* doubles some core dots; *erode* dissolves a share of the dots from one edge of the headline, from each letter's own edge (*strokes*), as holes from inside (*within*) or outline first (*rim*), and *release* carries some of the eroded dots off instead of dropping them; *letter variation* gives each letter its own small rotation, tone and nudge and *stagger* shifts letters so they sit unevenly; *smear* adds a fading motion trail behind the letters.

Every random draw is a 32-bit integer hash of (seed, salt, index), so the same input dots give the same output dots as the Python. `scripts/parity-express.ts <in.json> [out.json]` runs the stage on `{dots: [[x, y, t]...], comp, capMm, pitchMm, seed, params}` for comparison with `typeexpr.express`. All Expression defaults are the identity, so the presets and scenes render exactly as before.

Focus gains a *bokeh* style (patches of blur drifting across the type, sharp islands between; *patch size* sets their scale) and a *falloff curve* exponent (1.2 is the delivered curve; below 1 a soft shoulder, above 2 a sharp zone that drops). Blown dots gain *turbulence* (a wavy, curling path whose wavelength is *curl* caps) and *gravity* (+ drifts up, − falls); both 0 is the delivered blow, draw for draw.

## Fonts

Only Inter Display Medium ships (SIL Open Font License, `assets/fonts/Inter-OFL-LICENSE.txt`). It is the default.

The book is set in **Helvetica Now Display Medium, licensed to FIELD for two desktop users.** It is never committed, bundled or exported. To match the book on a licensed machine, drop your licensed OTF into the `font` parameter (Studio Inspector or the browser editor), or keep it in `assets/fonts/licensed/`, which is gitignored and where scene files look for it by name. Every `licensed/` directory is gitignored, and `npm run check:share` fails if a font other than Inter is tracked.

## Before you push

```sh
npm run check:share   # fails on .env files, tokens, Turso/libsql URLs, local paths, licensed fonts
```

## Maintainer notes

`scripts/parity-dots.ts <preset> <out.json> [font.otf]` runs the graph with an editor preset and writes the page dots; `scripts/compare-dots.ts a.json b.json` compares two such files. `scripts/parity.sh` compares the graph with the archived standalone app and cloud-plots; it needs `STANDALONE`, `PY` and `HELVETICA` set and is only useful on Marcus's machine.
