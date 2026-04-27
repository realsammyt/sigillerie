#!/usr/bin/env bash
# convert-formats.sh, Sigillerie video derivatives
#
# MP4 in, derived formats out: 60fps MP4, bayer-dithered GIF, WebM VP9,
# animated AVIF. Mirrors video-export.md's two-pass palette recipe with
# bayer + diff palettegen for 3D-quality GIFs.
#
# Usage:
#   bash scripts/convert-formats.sh <input.mp4> [options]
#
# Options:
#   --gif                  emit GIF (bayer + diff palettegen)
#   --gif-3d               emit GIF, per-frame palette refresh (camera-fly)
#   --webm                 emit WebM VP9
#   --avif                 emit animated AVIF (libsvtav1)
#   --60fps                force 60fps output (minterpolate if needed)
#   --output-dir=<path>    where derivatives go, default: same dir as input
#   --width=<px>           resize width for 60fps MP4, default: keep
#   --gif-fps=<n>          GIF framerate, default: 25
#   --gif-width=<px>       GIF width, default: 720
#   --help                 show this text and exit

set -euo pipefail

# ────────────────────────────────────────────────────────────
# PARSE, caveman reads flags, no fancy getopt
# ────────────────────────────────────────────────────────────

INPUT=""
DO_GIF=0
DO_GIF_3D=0
DO_WEBM=0
DO_AVIF=0
DO_60FPS=0
OUTPUT_DIR=""
WIDTH=""
GIF_FPS="25"
GIF_WIDTH="720"

print_help() {
  sed -n '2,22p' "$0" | sed 's/^# \{0,1\}//'
}

if [ "$#" -eq 0 ]; then
  print_help
  exit 1
fi

for arg in "$@"; do
  case "$arg" in
    --help|-h) print_help; exit 0 ;;
    --gif) DO_GIF=1 ;;
    --gif-3d) DO_GIF_3D=1 ;;
    --webm) DO_WEBM=1 ;;
    --avif) DO_AVIF=1 ;;
    --60fps) DO_60FPS=1 ;;
    --output-dir=*) OUTPUT_DIR="${arg#*=}" ;;
    --width=*) WIDTH="${arg#*=}" ;;
    --gif-fps=*) GIF_FPS="${arg#*=}" ;;
    --gif-width=*) GIF_WIDTH="${arg#*=}" ;;
    --*) echo "unknown flag: $arg" >&2; exit 1 ;;
    *)
      if [ -z "$INPUT" ]; then INPUT="$arg"
      else echo "unexpected positional arg: $arg" >&2; exit 1
      fi
      ;;
  esac
done

if [ -z "$INPUT" ]; then
  echo "no input file given" >&2
  print_help
  exit 1
fi

# caveman: at least one output target needed
if [ "$DO_GIF" -eq 0 ] && [ "$DO_GIF_3D" -eq 0 ] && [ "$DO_WEBM" -eq 0 ] \
   && [ "$DO_AVIF" -eq 0 ] && [ "$DO_60FPS" -eq 0 ]; then
  echo "pick at least one of: --gif --gif-3d --webm --avif --60fps" >&2
  exit 1
fi

# tools must exist
if ! command -v ffmpeg >/dev/null 2>&1; then
  echo "ffmpeg not found." >&2
  echo "install: macOS 'brew install ffmpeg'  /  ubuntu 'apt install ffmpeg'  /  win 'winget install Gyan.FFmpeg'" >&2
  exit 127
fi
if ! command -v ffprobe >/dev/null 2>&1; then
  echo "ffprobe not found (ships with ffmpeg)." >&2
  exit 127
fi

if [ ! -f "$INPUT" ]; then
  echo "input not found: $INPUT" >&2
  exit 1
fi

DIR=$(dirname "$INPUT")
BASE=$(basename "$INPUT")
STEM="${BASE%.*}"
OUT_DIR="${OUTPUT_DIR:-$DIR}"
mkdir -p "$OUT_DIR"

# ────────────────────────────────────────────────────────────
# PROBE, read input shape so later decisions are sane
# ────────────────────────────────────────────────────────────

probe_field() {
  ffprobe -v error -select_streams v:0 -show_entries "stream=$1" \
    -of default=nw=1:nk=1 "$INPUT"
}

IN_WIDTH=$(probe_field width || echo 0)
IN_HEIGHT=$(probe_field height || echo 0)
IN_FPS_RAW=$(probe_field r_frame_rate || echo "25/1")
IN_DURATION=$(ffprobe -v error -show_entries format=duration \
              -of default=nw=1:nk=1 "$INPUT" 2>/dev/null || echo "0")

# r_frame_rate is "num/den"; reduce to a number for comparison
IN_FPS=$(awk -v r="$IN_FPS_RAW" 'BEGIN{
  n=split(r,a,"/"); if(n==2 && a[2]>0) printf "%.3f", a[1]/a[2]; else printf "%s", r
}')

if [ -z "$IN_WIDTH" ] || [ "$IN_WIDTH" = "0" ]; then
  echo "ffprobe could not read input. is it a real video?" >&2
  exit 1
fi

echo "input  : $INPUT"
echo "  size : ${IN_WIDTH}x${IN_HEIGHT}  fps: ${IN_FPS}  dur: ${IN_DURATION}s"
echo "outputs: ${OUT_DIR}"

FAILED=()

run_step() {
  # name + command-as-string-array, captures failure without aborting batch
  local name="$1"; shift
  echo "▸ $name"
  if "$@"; then
    return 0
  else
    echo "  ✗ $name failed" >&2
    FAILED+=("$name")
    return 1
  fi
}

# ────────────────────────────────────────────────────────────
# 60FPS, minterpolate if source < 60, else pass-through encode
# ────────────────────────────────────────────────────────────

OUT_60FPS="$OUT_DIR/${STEM}-60fps.mp4"
SOURCE_FOR_DERIVS="$INPUT"   # GIF/WebM/AVIF prefer 60fps source if we made one

if [ "$DO_60FPS" -eq 1 ]; then
  # awk handles float compare without bc dependency
  NEED_INTERP=$(awk -v f="$IN_FPS" 'BEGIN{ print (f+0 < 60.0) ? 1 : 0 }')

  if [ -n "$WIDTH" ]; then
    SCALE_CHAIN=",scale=${WIDTH}:-2:flags=lanczos"
  else
    SCALE_CHAIN=""
  fi

  if [ "$NEED_INTERP" = "1" ]; then
    VFILTER="minterpolate=fps=60:mi_mode=mci:mc_mode=aobmc:me_mode=bidir:vsbmc=1${SCALE_CHAIN}"
    LABEL="60fps (minterpolate ${IN_FPS}→60)"
  else
    VFILTER="fps=60${SCALE_CHAIN}"
    LABEL="60fps (already ≥60, re-encode)"
  fi

  if run_step "$LABEL → $OUT_60FPS" \
      ffmpeg -y -loglevel error -i "$INPUT" \
        -vf "$VFILTER" \
        -c:v libx264 -pix_fmt yuv420p -profile:v high -level 4.0 \
        -crf 18 -preset medium -movflags +faststart \
        "$OUT_60FPS"; then
    SOURCE_FOR_DERIVS="$OUT_60FPS"
  fi
fi

# ────────────────────────────────────────────────────────────
# GIF, two-pass palette, bayer dither, diff stats. Pure 2D path.
# ────────────────────────────────────────────────────────────

emit_gif() {
  # $1 = output path, $2 = paletteuse extras (e.g. ":new=1" for 3D)
  local out="$1" extra="$2"
  local pal
  pal="$(mktemp -t pal.XXXXXX).png"

  # pass 1: palette tuned to this video
  ffmpeg -y -loglevel error -i "$SOURCE_FOR_DERIVS" \
    -vf "fps=${GIF_FPS},scale=${GIF_WIDTH}:-1:flags=lanczos,palettegen=max_colors=256:stats_mode=diff" \
    "$pal"

  # pass 2: bayer dither + rectangle diff for tiny files with smooth fades
  ffmpeg -y -loglevel error -i "$SOURCE_FOR_DERIVS" -i "$pal" \
    -lavfi "fps=${GIF_FPS},scale=${GIF_WIDTH}:-1:flags=lanczos[x];[x][1:v]paletteuse=dither=bayer:bayer_scale=3:diff_mode=rectangle${extra}" \
    -loop 0 "$out"

  rm -f "$pal"
}

if [ "$DO_GIF" -eq 1 ]; then
  OUT_GIF="$OUT_DIR/${STEM}.gif"
  run_step "GIF (${GIF_WIDTH}w @ ${GIF_FPS}fps, bayer+diff) → $OUT_GIF" \
    emit_gif "$OUT_GIF" "" || true
fi

if [ "$DO_GIF_3D" -eq 1 ]; then
  OUT_GIF3D="$OUT_DIR/${STEM}-3d.gif"
  # new=1 → palette refreshes per frame, kills banding on camera-fly scenes
  run_step "GIF-3D (${GIF_WIDTH}w @ ${GIF_FPS}fps, motion-aware palette) → $OUT_GIF3D" \
    emit_gif "$OUT_GIF3D" ":new=1" || true
fi

# ────────────────────────────────────────────────────────────
# WEBM, VP9 two-pass, row-mt for fast encode, transparent-alpha-friendly
# ────────────────────────────────────────────────────────────

if [ "$DO_WEBM" -eq 1 ]; then
  OUT_WEBM="$OUT_DIR/${STEM}.webm"
  PASSLOG="$(mktemp -t webmpass.XXXXXX)"

  # caveman: pass 1 = analyze, pass 2 = encode. -b:v 0 + crf = constant quality
  if ffmpeg -y -loglevel error -i "$SOURCE_FOR_DERIVS" \
        -c:v libvpx-vp9 -b:v 0 -crf 30 -row-mt 1 -tile-columns 2 \
        -pass 1 -passlogfile "$PASSLOG" -an -f webm /dev/null \
     && ffmpeg -y -loglevel error -i "$SOURCE_FOR_DERIVS" \
        -c:v libvpx-vp9 -b:v 0 -crf 30 -row-mt 1 -tile-columns 2 \
        -pass 2 -passlogfile "$PASSLOG" -an "$OUT_WEBM"; then
    echo "▸ WebM VP9 → $OUT_WEBM ✓"
  else
    echo "  ✗ WebM failed" >&2
    FAILED+=("webm")
  fi
  rm -f "${PASSLOG}-0.log" "${PASSLOG}-0.log.mbtree" "$PASSLOG" 2>/dev/null || true
fi

# ────────────────────────────────────────────────────────────
# AVIF, animated, SVT-AV1. Smaller than GIF, modern player support.
# ────────────────────────────────────────────────────────────

if [ "$DO_AVIF" -eq 1 ]; then
  OUT_AVIF="$OUT_DIR/${STEM}.avif"
  # libsvtav1 needs reasonably new ffmpeg (≥5.1). preset 6 is the speed/quality knee.
  run_step "animated AVIF (libsvtav1, crf 28) → $OUT_AVIF" \
    ffmpeg -y -loglevel error -i "$SOURCE_FOR_DERIVS" \
      -c:v libsvtav1 -crf 28 -preset 6 -pix_fmt yuv420p10le \
      -loop 0 -an "$OUT_AVIF" || true
fi

# ────────────────────────────────────────────────────────────
# VERIFY, every emitted file: probe back, sanity-check size + duration
# ────────────────────────────────────────────────────────────

verify() {
  # $1 = path, $2 = expect-video (1) or any-stream (0, for gif animated)
  local path="$1"
  if [ ! -f "$path" ]; then
    echo "  ✗ verify: missing $path" >&2
    return 1
  fi
  local size_bytes
  size_bytes=$(wc -c < "$path" | tr -d ' ')
  if [ "$size_bytes" -lt 1024 ]; then
    echo "  ✗ verify: $path is suspiciously tiny (${size_bytes} bytes)" >&2
    return 1
  fi
  local dur
  dur=$(ffprobe -v error -show_entries format=duration -of default=nw=1:nk=1 "$path" 2>/dev/null || echo "0")
  local has_video
  has_video=$(ffprobe -v error -select_streams v:0 -show_entries stream=codec_type \
              -of default=nw=1:nk=1 "$path" 2>/dev/null || echo "")
  if [ -z "$has_video" ]; then
    echo "  ✗ verify: $path has no video stream" >&2
    return 1
  fi
  printf "  ✓ %s  size=%s  dur=%ss  codec=%s\n" \
    "$(basename "$path")" \
    "$(awk -v b="$size_bytes" 'BEGIN{ split("B KB MB GB",u); i=1; while(b>=1024 && i<4){b/=1024; i++}; printf "%.1f%s", b, u[i] }')" \
    "$dur" \
    "$(ffprobe -v error -select_streams v:0 -show_entries stream=codec_name -of default=nw=1:nk=1 "$path" 2>/dev/null)"
}

echo ""
echo "verify:"
[ "$DO_60FPS" -eq 1 ] && [ -f "$OUT_60FPS" ]   && verify "$OUT_60FPS"   || true
[ "$DO_GIF" -eq 1 ]   && [ -f "${OUT_DIR}/${STEM}.gif" ]    && verify "${OUT_DIR}/${STEM}.gif"    || true
[ "$DO_GIF_3D" -eq 1 ] && [ -f "${OUT_DIR}/${STEM}-3d.gif" ] && verify "${OUT_DIR}/${STEM}-3d.gif" || true
[ "$DO_WEBM" -eq 1 ]  && [ -f "${OUT_DIR}/${STEM}.webm" ]   && verify "${OUT_DIR}/${STEM}.webm"   || true
[ "$DO_AVIF" -eq 1 ]  && [ -f "${OUT_DIR}/${STEM}.avif" ]   && verify "${OUT_DIR}/${STEM}.avif"   || true

if [ "${#FAILED[@]}" -gt 0 ]; then
  echo ""
  echo "completed with failures: ${FAILED[*]}" >&2
  exit 2
fi

echo ""
echo "done."
