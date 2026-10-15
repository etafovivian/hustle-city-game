#!/usr/bin/env bash
# Converts layered sprite renders (scripts/blender/agent/sprites.py LAYERS=base|hair, MASK=1) into the WebP layers the
# app composes at runtime (src/components/spriteComposer.ts).
#   bash scripts/convert-layers.sh <dir with LB LM LH> public/art/life/layers
# LB: base renders (<sheet>-L-<body>-<outfit>-<dir>.png), LM: their masks (same names), LH: hair renders
# (<sheet>-H-<body>-<style>-<dir>.png). Contact sheets are skipped. Needs cwebp.
SRC=$1; OUT=$2
mkdir -p "$OUT"
conv() { # file kind
  f=$1; kind=$2; b=$(basename "$f" .png)
  case "$b" in *contact*) return;; esac
  if [ "$kind" = H ]; then rest=${b#*-H-}; else rest=${b#*-L-}; fi
  sheet=${b%%-[LH]-*}
  body=${rest%%-*}; r2=${rest#*-}; dir=${r2##*-}; key=${r2%-*}
  if [ "$kind" = H ]; then d="$OUT/hair-$body-$key"; else d="$OUT/$body-$key"; fi
  mkdir -p "$d"
  case $kind in
    L) cwebp -quiet -q 88 -m 4 "$f" -o "$d/$sheet-$dir.webp";;
    M) cwebp -quiet -lossless -z 6 "$f" -o "$d/$sheet-$dir.m.webp";;
    H) cwebp -quiet -q 90 -m 4 "$f" -o "$d/$sheet-$dir.webp";;
  esac
}
export -f conv; export OUT
ls "$SRC"/LB/*.png | xargs -P 6 -I{} bash -c 'conv {} L'
ls "$SRC"/LM/*.png | xargs -P 6 -I{} bash -c 'conv {} M'
ls "$SRC"/LH/*.png | xargs -P 6 -I{} bash -c 'conv {} H'
