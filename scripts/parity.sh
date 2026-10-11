#!/usr/bin/env bash
# Parity matrix: the Cascade graph against the standalone app (~/Documents/Dev/cloud-type)
# and against cloud-plots (Python), for co-approved and co-1c, in Inter and in the
# licensed Helvetica Now Display (read in place, never copied). Writes to export/parity/.
set -euo pipefail
cd "$(dirname "$0")/.."
STANDALONE=${STANDALONE:-$HOME/Documents/Dev/cloud-type}
PY=${PY:-$HOME/Documents/Cascade/cloud-plots/.venv/bin/python3}
HELVETICA=${HELVETICA:-$HOME/Documents/Cascade/cloud-plots/assets/fonts/licensed/HelveticaNowDisplay-Md.otf}
INTER=$PWD/assets/fonts/InterDisplay-Medium.otf
OUT=$PWD/export/parity
mkdir -p "$OUT"
for preset in co-approved co-1c; do
  for font in inter helvetica; do
    f=$INTER; [ "$font" = helvetica ] && f=$HELVETICA
    echo "== $preset · $font"
    (cd "$STANDALONE" && npx tsx scripts/dots.ts "$preset" "$f" "$OUT/standalone-$preset-$font.json" >/dev/null)
    npx tsx scripts/parity-dots.ts "$preset" "$OUT/graph-$preset-$font.json" "$f" >/dev/null
    npx tsx scripts/compare-dots.ts "$OUT/standalone-$preset-$font.json" "$OUT/graph-$preset-$font.json" | sed 's/^a:/standalone:/; s/^b:/graph:     /'
    # cloud-plots always sets the licensed face (titletype.NOW); the Inter rows compare a different font.
    "$PY" "$STANDALONE/scripts/parity.py" "$OUT/graph-$preset-$font.json" "$OUT/parity-$preset-$font.jpg" | sed 's/^ts:/graph (py stats):/'
  done
done
