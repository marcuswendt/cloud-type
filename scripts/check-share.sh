#!/bin/sh
# Refuse to share this repo if it holds secrets, local paths or licensed fonts.
# Scans every file git would push (tracked + staged), and the vendored Cascade tarball.
set -eu
cd "$(dirname "$0")/.."
fail=0
files=$(git ls-files --cached --others --exclude-standard | grep -v '^vendor/.*\.tgz$' | grep -v '^scripts/check-share.sh$' || true)

hit() { echo "check-share: $1" >&2; fail=1; }

# Env files and credentials
echo "$files" | grep -E '(^|/)\.env' >/dev/null && hit ".env file is tracked"
echo "$files" | grep -E '(^|/)\.vercel/' >/dev/null && hit ".vercel link is tracked"
# Fonts: only Inter Display (OFL) may ship
for f in $(echo "$files" | grep -iE '\.(otf|ttf|woff2?)$' || true); do
  case "$f" in assets/fonts/InterDisplay-Medium.otf) ;; *) hit "font not allowed: $f" ;; esac
done
echo "$files" | grep -i 'helvetica' >/dev/null && hit "a Helvetica file is tracked"
echo "$files" | grep -E '(^|/)licensed/' >/dev/null && hit "a licensed/ directory is tracked"

PATTERN='(^|[^A-Za-z0-9._-])/(Users|home)/[A-Za-z]|libsql://[a-z0-9]|turso\.io|ghp_[A-Za-z0-9]{36}|github_pat_[A-Za-z0-9_]{40}|sk-(ant|proj)-[A-Za-z0-9_-]{30}|xox[bp]-[0-9]|AKIA[0-9A-Z]{16}|-----BEGIN [A-Z ]*PRIVATE KEY'
for f in $files; do
  [ -f "$f" ] || continue
  case "$f" in *.otf|*.png|*.jpg) continue ;; esac
  if grep -nE "$PATTERN" "$f" >/dev/null 2>&1; then hit "secret or local path in $f: $(grep -nE "$PATTERN" "$f" | head -1 | cut -c1-120)"; fi
done

# Vendored tarball: no env files, no secrets, no local paths
for t in vendor/*.tgz; do
  [ -f "$t" ] || continue
  tar tzf "$t" | grep -E '(^|/)\.env|\.vercel/' >/dev/null && hit "$t contains an env or .vercel file"
  tmp=$(mktemp -d); tar xzf "$t" -C "$tmp"
  if grep -rlE "$PATTERN" "$tmp" >/dev/null 2>&1; then hit "$t: secret or local path in $(grep -rlE "$PATTERN" "$tmp" | head -3 | sed "s#$tmp/##")"; fi
  rm -rf "$tmp"
done

[ "$fail" = 0 ] && echo "check-share: clean" || exit 1
