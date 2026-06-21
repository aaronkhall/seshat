#!/usr/bin/env sh
# Prepare the GraphHopper input: download the source extract once and crop it to
# the configured bbox, into the shared /data volume. Idempotent — skips if the
# cropped region already exists (so redeploys don't re-download the ~1.4 GB file).
set -eu

DATA=/data
SRC="$DATA/source.osm.pbf"
REGION="$DATA/region.osm.pbf"
EXTRACT_URL="${EXTRACT_URL:-https://download.geofabrik.de/australia-oceania/australia-latest.osm.pbf}"
CROP_BBOX="${CROP_BBOX:-151.5,-28.5,153.6,-26.3}" # left,bottom,right,top (min lon,lat / max lon,lat)

mkdir -p "$DATA"

if [ -f "$REGION" ]; then
  echo "[seshat-prep] $REGION already present — skipping download/crop"
  exit 0
fi

if [ ! -f "$SRC" ]; then
  echo "[seshat-prep] downloading $EXTRACT_URL"
  curl -fL --retry 3 -o "$SRC.tmp" "$EXTRACT_URL"
  mv "$SRC.tmp" "$SRC"
fi

echo "[seshat-prep] cropping to bbox $CROP_BBOX"
osmium extract -b "$CROP_BBOX" "$SRC" -o "$REGION" --overwrite
rm -f "$SRC" # free disk; keep only the cropped region
echo "[seshat-prep] done -> $REGION"
