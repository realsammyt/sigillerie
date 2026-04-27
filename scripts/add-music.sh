#!/usr/bin/env bash
# add-music.sh, Sigillerie producer-mode audio post.
#
# Mix BGM + time-aligned SFX into a rendered MP4. Reads an optional
# audio-cues.json sidecar to place SFX. Applies frequency-band isolation
# (BGM lowpass 2 kHz, SFX highpass 1 kHz), optional sidechain ducking,
# and two-pass loudnorm for platform-correct LUFS. See
# modes/producer/audio-design-rules.md for the why behind the numbers.
#
# Usage:
#   bash scripts/add-music.sh <input.mp4> [options]
#
# Options:
#   --bgm=<path>         BGM mp3 (default: assets/audio/sigillerie-default/bgm-tutorial.mp3)
#   --bgm-volume=<db>    BGM master volume in dB (default: -18)
#   --sfx-cues=<path>    audio-cues.json sidecar
#                        (default: <input>.audio-cues.json next to input)
#   --duck-bgm           sidechain duck BGM under SFX (4:1, 5ms attack, 200ms release)
#   --output=<path>      output mp4 (default: <input>.scored.mp4)
#   --lufs=<target>      integrated LUFS target (default: -14)
#   --help               show this help
#
# audio-cues.json format:
#   { "cues": [
#       { "t": 1.2, "type": "sfx", "file": "...whoosh.mp3", "gain_db": -6 },
#       { "t": 4.0, "type": "sfx", "file": "...click.mp3",  "gain_db": -3 }
#   ] }

set -euo pipefail

# ─── PARSE_ARGS ──────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
DEFAULT_BGM="$REPO_ROOT/assets/audio/sigillerie-default/bgm-tutorial.mp3"

INPUT=""
BGM=""
BGM_VOLUME_DB="-18"
SFX_CUES=""
DUCK_BGM=0
OUTPUT=""
LUFS_TARGET="-14"

print_help() { sed -n '2,28p' "$0" | sed 's/^# \{0,1\}//'; }

if [ $# -eq 0 ]; then print_help; exit 1; fi

for arg in "$@"; do
  case "$arg" in
    --help|-h)         print_help; exit 0 ;;
    --bgm=*)           BGM="${arg#*=}" ;;
    --bgm-volume=*)    BGM_VOLUME_DB="${arg#*=}" ;;
    --sfx-cues=*)      SFX_CUES="${arg#*=}" ;;
    --duck-bgm)        DUCK_BGM=1 ;;
    --output=*)        OUTPUT="${arg#*=}" ;;
    --lufs=*)          LUFS_TARGET="${arg#*=}" ;;
    --*)               echo "✗ Unknown option: $arg" >&2; exit 1 ;;
    *)                 [ -z "$INPUT" ] && INPUT="$arg" || { echo "✗ Extra positional: $arg" >&2; exit 1; } ;;
  esac
done

# Validate input.
if [ -z "$INPUT" ] || [ ! -f "$INPUT" ]; then
  echo "✗ Input MP4 not found: $INPUT" >&2; exit 1
fi
command -v ffmpeg  >/dev/null 2>&1 || { echo "✗ ffmpeg not installed"  >&2; exit 1; }
command -v ffprobe >/dev/null 2>&1 || { echo "✗ ffprobe not installed" >&2; exit 1; }

# Confirm input has video.
HAS_VIDEO=$(ffprobe -v error -select_streams v:0 -show_entries stream=codec_type \
              -of default=noprint_wrappers=1:nokey=1 "$INPUT" || true)
if [ "$HAS_VIDEO" != "video" ]; then
  echo "✗ No video stream in: $INPUT" >&2; exit 1
fi
DURATION=$(ffprobe -v error -show_entries format=duration \
            -of default=noprint_wrappers=1:nokey=1 "$INPUT")
[ -z "$DURATION" ] && { echo "✗ Could not read duration" >&2; exit 1; }

# Resolve BGM with fallback.
if [ -z "$BGM" ]; then BGM="$DEFAULT_BGM"; fi
if [ ! -f "$BGM" ]; then
  echo "⚠ BGM not found ($BGM), falling back to default" >&2
  BGM="$DEFAULT_BGM"
fi
if [ ! -f "$BGM" ]; then
  echo "✗ Default BGM also missing: $DEFAULT_BGM" >&2; exit 1
fi

# Resolve sidecar path (auto-detect if not specified).
INPUT_DIR="$(cd "$(dirname "$INPUT")" && pwd)"
INPUT_BASE="$(basename "$INPUT")"
INPUT_STEM="${INPUT_BASE%.*}"
if [ -z "$SFX_CUES" ]; then
  AUTO_SIDECAR="$INPUT_DIR/$INPUT_BASE.audio-cues.json"
  [ -f "$AUTO_SIDECAR" ] && SFX_CUES="$AUTO_SIDECAR"
fi

# Resolve output.
[ -z "$OUTPUT" ] && OUTPUT="$INPUT_DIR/$INPUT_STEM.scored.mp4"

# Tmp scratch dir.
TMPDIR_LOCAL="$(mktemp -d)"
trap 'rm -rf "$TMPDIR_LOCAL"' EXIT

# Convert dB to linear scale for ffmpeg volume filter inputs that need it.
db_to_linear() { awk -v db="$1" 'BEGIN { printf "%.6f", 10 ^ (db / 20) }'; }
BGM_VOL_LINEAR=$(db_to_linear "$BGM_VOLUME_DB")

echo "▸ Sigillerie audio post"
echo "  input:    $INPUT (${DURATION}s)"
echo "  bgm:      $BGM ($BGM_VOLUME_DB dB → $BGM_VOL_LINEAR)"
echo "  cues:     ${SFX_CUES:-<none>}"
echo "  duck:     $([ "$DUCK_BGM" = 1 ] && echo on || echo off)"
echo "  lufs:     $LUFS_TARGET"
echo "  output:   $OUTPUT"

# ─── READ_CUES ───────────────────────────────────────────────────────
# Parse cues into 3 parallel bash arrays. Use python for JSON safety.
CUE_TIMES=()
CUE_FILES=()
CUE_GAINS=()

if [ -n "$SFX_CUES" ] && [ -f "$SFX_CUES" ]; then
  command -v python3 >/dev/null 2>&1 || { echo "✗ python3 needed to parse cue JSON" >&2; exit 1; }
  CUE_TSV="$TMPDIR_LOCAL/cues.tsv"
  python3 - "$SFX_CUES" > "$CUE_TSV" <<'PY'
import json, sys
with open(sys.argv[1], "r", encoding="utf-8") as fh:
    data = json.load(fh)
for c in data.get("cues", []):
    if c.get("type", "sfx") != "sfx": continue
    t = float(c.get("t", 0))
    f = c.get("file", "")
    g = float(c.get("gain_db", 0))
    if not f: continue
    print(f"{t}\t{f}\t{g}")
PY
  while IFS=$'\t' read -r T F G; do
    [ -z "$T" ] && continue
    # Resolve cue file path (allow repo-relative).
    if [ ! -f "$F" ]; then
      ALT="$REPO_ROOT/$F"
      if [ -f "$ALT" ]; then F="$ALT"
      else echo "⚠ SFX missing, skipping cue @ ${T}s: $F" >&2; continue
      fi
    fi
    CUE_TIMES+=("$T")
    CUE_FILES+=("$F")
    CUE_GAINS+=("$G")
  done < "$CUE_TSV"
fi

N_CUES=${#CUE_FILES[@]}
echo "  loaded:   $N_CUES sfx cues"

# ─── BUILD_FILTERGRAPH ───────────────────────────────────────────────
MIXED_WAV="$TMPDIR_LOCAL/mixed.wav"
NORM_WAV="$TMPDIR_LOCAL/normalized.wav"

# BGM chain: trim to video duration, fade in/out, lowpass 2 kHz, set volume.
FADE_OUT_START=$(awk "BEGIN { d = $DURATION - 1.5; if (d < 0) d = 0; print d }")
BGM_CHAIN="atrim=0:${DURATION},asetpts=PTS-STARTPTS,afade=t=in:st=0:d=0.3,afade=t=out:st=${FADE_OUT_START}:d=1.5,lowpass=f=2000,volume=${BGM_VOL_LINEAR}"

if [ "$N_CUES" -eq 0 ]; then
  # Simple path: BGM only.
  echo "▸ Mixing BGM only (no cues)"
  ffmpeg -y -hide_banner -loglevel error \
    -i "$BGM" \
    -filter_complex "[0:a]${BGM_CHAIN}[bgm];[bgm]aformat=sample_rates=48000:channel_layouts=stereo[a]" \
    -map "[a]" -ac 2 -ar 48000 -c:a pcm_s16le -t "$DURATION" \
    "$MIXED_WAV" 2> "$TMPDIR_LOCAL/ffmpeg.err" || {
      echo "✗ ffmpeg BGM mix failed:" >&2; cat "$TMPDIR_LOCAL/ffmpeg.err" >&2; exit 1; }
else
  # Complex path: BGM + N SFX with delays, optional ducking, then mix.
  FG_INPUTS=( -i "$BGM" )
  for f in "${CUE_FILES[@]}"; do FG_INPUTS+=( -i "$f" ); done

  FG=""
  FG+="[0:a]${BGM_CHAIN}[bgm];"

  # Each SFX: highpass 1 kHz, gain, delay by t*1000 ms on both channels.
  SFX_LABELS=""
  for i in $(seq 0 $((N_CUES - 1))); do
    IDX=$((i + 1))           # ffmpeg input index (BGM is 0)
    T="${CUE_TIMES[$i]}"
    G="${CUE_GAINS[$i]}"
    DELAY_MS=$(awk -v t="$T" 'BEGIN { printf "%d", t * 1000 }')
    G_LIN=$(db_to_linear "$G")
    FG+="[${IDX}:a]highpass=f=1000,volume=${G_LIN},adelay=${DELAY_MS}|${DELAY_MS},apad[sfx${i}];"
    SFX_LABELS+="[sfx${i}]"
  done

  # Combine all SFX into one bus.
  FG+="${SFX_LABELS}amix=inputs=${N_CUES}:duration=longest:normalize=0[allsfx];"
  FG+="[allsfx]atrim=0:${DURATION},asetpts=PTS-STARTPTS[sfxbus];"

  # Optional sidechain ducking. Use a copy of sfxbus as the trigger (asplit).
  if [ "$DUCK_BGM" = 1 ]; then
    FG+="[sfxbus]asplit=2[sfx_a][sfx_b];"
    FG+="[bgm][sfx_a]sidechaincompress=threshold=0.05:ratio=4:attack=5:release=200[bgm_ducked];"
    FG+="[bgm_ducked][sfx_b]amix=inputs=2:duration=first:normalize=0[mix];"
  else
    FG+="[bgm][sfxbus]amix=inputs=2:duration=first:normalize=0[mix];"
  fi

  FG+="[mix]aformat=sample_rates=48000:channel_layouts=stereo[a]"

  echo "▸ Mixing BGM + $N_CUES SFX cues"
  ffmpeg -y -hide_banner -loglevel error \
    "${FG_INPUTS[@]}" \
    -filter_complex "$FG" \
    -map "[a]" -ac 2 -ar 48000 -c:a pcm_s16le -t "$DURATION" \
    "$MIXED_WAV" 2> "$TMPDIR_LOCAL/ffmpeg.err" || {
      echo "✗ ffmpeg filtergraph failed:" >&2; cat "$TMPDIR_LOCAL/ffmpeg.err" >&2; exit 1; }
fi

# ─── LOUDNORM (two-pass) ────────────────────────────────────────────
echo "▸ Loudnorm pass 1 (measure)"
LN_LOG="$TMPDIR_LOCAL/loudnorm.log"
ffmpeg -y -hide_banner -nostats -i "$MIXED_WAV" \
  -af "loudnorm=I=${LUFS_TARGET}:TP=-1.0:LRA=11:print_format=json" \
  -f null - 2> "$LN_LOG" || {
    echo "⚠ loudnorm pass 1 failed; copying mix without normalization" >&2
    cp "$MIXED_WAV" "$NORM_WAV"
}

if [ ! -f "$NORM_WAV" ]; then
  # Extract JSON block from log (last { ... } block).
  LN_JSON="$TMPDIR_LOCAL/loudnorm.json"
  python3 - "$LN_LOG" > "$LN_JSON" <<'PY'
import re, sys
txt = open(sys.argv[1], "r", encoding="utf-8", errors="replace").read()
m = re.findall(r"\{[^{}]*\"input_i\"[^{}]*\}", txt, re.S)
sys.stdout.write(m[-1] if m else "")
PY
  if [ -s "$LN_JSON" ]; then
    read -r M_I M_TP M_LRA M_THRESH M_OFFSET < <(python3 - "$LN_JSON" <<'PY'
import json, sys
d = json.load(open(sys.argv[1], "r", encoding="utf-8"))
print(d["input_i"], d["input_tp"], d["input_lra"], d["input_thresh"], d["target_offset"])
PY
)
    echo "▸ Loudnorm pass 2 (apply: I=$M_I TP=$M_TP LRA=$M_LRA)"
    ffmpeg -y -hide_banner -loglevel error -i "$MIXED_WAV" \
      -af "loudnorm=I=${LUFS_TARGET}:TP=-1.0:LRA=11:measured_I=${M_I}:measured_TP=${M_TP}:measured_LRA=${M_LRA}:measured_thresh=${M_THRESH}:offset=${M_OFFSET}:linear=true:print_format=summary" \
      -ar 48000 -ac 2 -c:a pcm_s16le \
      "$NORM_WAV" 2> "$TMPDIR_LOCAL/ffmpeg.err" || {
        echo "⚠ loudnorm pass 2 failed; using unnormalized mix" >&2
        cp "$MIXED_WAV" "$NORM_WAV"; }
  else
    echo "⚠ Could not parse loudnorm JSON; using unnormalized mix" >&2
    cp "$MIXED_WAV" "$NORM_WAV"
  fi
fi

# ─── MUX ─────────────────────────────────────────────────────────────
echo "▸ Muxing video + audio"
ffmpeg -y -hide_banner -loglevel error \
  -i "$INPUT" -i "$NORM_WAV" \
  -map 0:v:0 -map 1:a:0 \
  -c:v copy -c:a aac -b:a 192k -shortest \
  "$OUTPUT" 2> "$TMPDIR_LOCAL/ffmpeg.err" || {
    echo "✗ ffmpeg mux failed:" >&2; cat "$TMPDIR_LOCAL/ffmpeg.err" >&2; exit 1; }

# ─── VERIFY ──────────────────────────────────────────────────────────
OUT_ACHAN=$(ffprobe -v error -select_streams a:0 -show_entries stream=channels \
             -of default=noprint_wrappers=1:nokey=1 "$OUTPUT" || echo 0)
OUT_DUR=$(ffprobe -v error -show_entries format=duration \
           -of default=noprint_wrappers=1:nokey=1 "$OUTPUT" || echo 0)
DUR_DIFF=$(awk -v a="$OUT_DUR" -v b="$DURATION" 'BEGIN { d=a-b; if (d<0) d=-d; print d }')

if [ "${OUT_ACHAN:-0}" -lt 2 ]; then
  echo "⚠ Output audio has <2 channels ($OUT_ACHAN)" >&2
fi
if awk -v d="$DUR_DIFF" 'BEGIN { exit !(d > 0.5) }'; then
  echo "⚠ Output duration drift: ${DUR_DIFF}s (in=${DURATION}, out=${OUT_DUR})" >&2
fi

SIZE=$(du -h "$OUTPUT" 2>/dev/null | cut -f1 || echo "?")
echo "✓ Done: $OUTPUT  ($SIZE, ${OUT_DUR}s, ${OUT_ACHAN}ch)"
