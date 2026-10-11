#!/bin/sh
# Re-vendor Cascade from a checkout: builds and packs it, replaces vendor/*.tgz, reinstalls.
# Usage: npm run vendor:cascade -- <path to a cascade checkout>
set -eu
src=${1:?usage: npm run vendor:cascade -- <path to a cascade checkout>}
cd "$(dirname "$0")/.."
root=$PWD
tgz=$(cd "$src" && npm pack --silent --pack-destination "$root/vendor" | tail -1)
for old in vendor/*.tgz; do [ "$old" = "vendor/$tgz" ] || rm -f "$old"; done
npm pkg set "devDependencies.cascade=file:vendor/$tgz"
npm install
sh scripts/check-share.sh
