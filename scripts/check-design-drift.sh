#!/usr/bin/env bash
# Flags hardcoded colors outside the design-token file.
# Usage: bash scripts/check-design-drift.sh [src_dir]   (default: src under the repo root)
# Runs from the repo root (the parent of scripts/) wherever it is called; a src_dir
# argument is resolved against the caller's directory and should be inside the repo (paths
# outside it are printed in full, so no exemption applies). Call it by its real path, not a symlink.
# The tokens file comes from the "Tokens file:" line of docs/DESIGN_DIRECTION.md.
# An optional "Allowed color files:" line (comma-separated paths from the repo root, or
# "none") exempts other files, such as a fixed palette that cannot be a CSS variable.
# Exit 0: clean or skipped. Exit 1: hardcoded colors found. Exit 2: the check could not run.
set -u
unset CDPATH  # a CDPATH hit makes cd print the directory, which would end up in ROOT
ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd -P)" || exit 2
DOC="docs/DESIGN_DIRECTION.md"

if [ $# -ge 1 ]; then
  [ -d "$1" ] || { echo "ERROR: source dir '$1' not found" >&2; exit 2; }
  SRC_ARG="$1"
else
  SRC_ARG="$ROOT/src"
  [ -d "$SRC_ARG" ] || { echo "SKIP: source dir 'src' not found (pass it as the first argument)"; exit 0; }
fi
SRC_ABS="$(cd -- "$SRC_ARG" && pwd -P)" || { echo "ERROR: cannot enter '$SRC_ARG'" >&2; exit 2; }
cd -- "$ROOT" || exit 2
# Root-relative, so grep prints paths in the same form as the DOC lines.
case "$SRC_ABS" in
  "$ROOT") SRC="." ;;
  "$ROOT"/*) SRC="${SRC_ABS#"$ROOT"/}" ;;
  *) SRC="$SRC_ABS" ;;
esac

# Trim surrounding spaces and a leading "./".
trim() { sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//' -e 's|^\./||'; }

TOKENS="$(sed -n 's/^Tokens file:[[:space:]]*//p' "$DOC" 2>/dev/null | head -n1 | trim)"
case "$TOKENS" in ""|TBD|tbd) echo "SKIP: no tokens file recorded in $DOC yet"; exit 0 ;; esac
ALLOWED="$(sed -n 's/^Allowed color files:[[:space:]]*//p' "$DOC" 2>/dev/null | head -n1)"
case "$(printf '%s' "$ALLOWED" | trim)" in none|None|NONE|TBD|tbd) ALLOWED="" ;; esac

# Exempt paths, one per line: the tokens file and each allowed file.
EXEMPT="$(printf '%s\n%s\n' "$TOKENS" "$ALLOWED" | tr ',' '\n' | trim | sed '/^$/d')"

raw="$(grep -rnIE \
  --include='*.css' --include='*.scss' --include='*.sass' --include='*.less' \
  --include='*.tsx' --include='*.jsx' --include='*.ts' --include='*.js' \
  --include='*.vue' --include='*.svelte' --include='*.html' \
  --exclude-dir=node_modules --exclude-dir=dist --exclude-dir=build --exclude-dir=.next \
  -e '(^|[^A-Za-z0-9_&-])#[0-9a-fA-F]{3,8}([^A-Za-z0-9_-]|$)' \
  -e '(rgb|rgba|hsl|hsla|oklch)\(' \
  -- "$SRC")"
[ $? -le 1 ] || { echo "ERROR: grep failed on '$SRC'" >&2; exit 2; }
hits="$(printf '%s\n' "$raw" | sed 's|^\./||' \
  | EXEMPT="$EXEMPT" awk 'BEGIN { n = split(ENVIRON["EXEMPT"], ex, "\n") }
      NF { for (i = 1; i <= n; i++) if (index($0, ex[i] ":") == 1) next; print }')"

if [ -z "$hits" ]; then echo "PASS: no hardcoded colors outside $TOKENS"; exit 0; fi
printf '%s\n' "$hits" | head -n 40
echo "FAIL: $(printf '%s\n' "$hits" | wc -l | tr -d ' ') hardcoded color(s) outside $TOKENS."
echo "(URL fragments like href=\"#cafe\" can false-positive; use the tokens for real colors.)"
exit 1
