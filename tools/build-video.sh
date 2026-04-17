#!/usr/bin/env bash
# Builds the Volux per-tab demo video.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
FFMPEG="$ROOT/tools/node_modules/ffmpeg-static/ffmpeg"
FRAMES="$ROOT/tools/frames"
OUT="$ROOT/marketing/generated"
CAPS="$ROOT/tools/captions"
FONT="/usr/share/fonts/truetype/roboto/unhinted/RobotoTTF/Roboto-Bold.ttf"
mkdir -p "$OUT" "$CAPS"

IN_FPS=24
HOLD_END=2.0
TOTAL_DUR=8.25

# ---------- captions (ImageMagick pre-renders transparent PNGs) -----------
render_caption() {
  local text="$1" out="$2" size="${3:-32}"
  convert -size 760x90 xc:transparent \
    -gravity center \
    -fill "#000000cc" -draw "roundrectangle 120,18 640,72 28,28" \
    -font "$FONT" -pointsize "$size" -fill white \
    -annotate 0 "$text" \
    "$out"
}
render_caption "Three tabs on one site"                   "$CAPS/cap1.png"
render_caption "Pro lets each tab hold its own volume"    "$CAPS/cap2.png" 28
render_caption "Mute one. Reset another. Default stays."  "$CAPS/cap3.png" 26
render_caption "Volux Pro  -  per-tab volume  -  \$2 one-time" "$CAPS/cap4.png" 26

# ---------- stage 1: silent video with captions ---------------------------
# Canvas 760x1520: popup frames are up to 760x1416 when fully expanded;
# top-align the popup and place captions in the ~100px strip below it.
echo "[1/3] Encoding video layer (captions overlaid, no audio)..."
"$FFMPEG" -y \
  -framerate "$IN_FPS" -i "$FRAMES/%04d.png" \
  -f lavfi -t "$TOTAL_DUR" -i "color=black:s=760x1520" \
  -loop 1 -t "$TOTAL_DUR" -i "$CAPS/cap1.png" \
  -loop 1 -t "$TOTAL_DUR" -i "$CAPS/cap2.png" \
  -loop 1 -t "$TOTAL_DUR" -i "$CAPS/cap3.png" \
  -loop 1 -t "$TOTAL_DUR" -i "$CAPS/cap4.png" \
  -filter_complex "\
    [0:v]tpad=stop_mode=clone:stop_duration=$HOLD_END,fps=$IN_FPS,format=yuv420p[vpad];\
    [1:v][vpad]overlay=(W-w)/2:0[scene];\
    [scene][2:v]overlay=x=(W-w)/2:y=1420:enable='between(t,0.2,1.4)'[s1];\
    [s1][3:v]overlay=x=(W-w)/2:y=1420:enable='between(t,1.6,4.3)'[s2];\
    [s2][4:v]overlay=x=(W-w)/2:y=1420:enable='between(t,4.5,6.3)'[s3];\
    [s3][5:v]overlay=x=(W-w)/2:y=1420:enable='between(t,6.5,$TOTAL_DUR)'[vout]" \
  -map "[vout]" \
  -c:v libx264 -preset medium -crf 20 -pix_fmt yuv420p \
  -t "$TOTAL_DUR" \
  "$OUT/.video-only.mp4"

# ---------- stage 2: soundtrack (A-minor pad + clicks + end chime) --------
echo "[2/3] Encoding audio layer..."
"$FFMPEG" -y \
  -f lavfi -i "sine=f=220:d=$TOTAL_DUR" \
  -f lavfi -i "sine=f=261.63:d=$TOTAL_DUR" \
  -f lavfi -i "sine=f=329.63:d=$TOTAL_DUR" \
  -f lavfi -i "sine=f=880:d=0.12" \
  -f lavfi -i "sine=f=660:d=0.08" \
  -f lavfi -i "sine=f=660:d=0.08" \
  -f lavfi -i "sine=f=660:d=0.08" \
  -f lavfi -i "sine=f=440:d=0.3" \
  -f lavfi -i "sine=f=554.37:d=0.3" \
  -f lavfi -i "sine=f=659.25:d=0.4" \
  -filter_complex "\
    [0][1][2]amix=inputs=3:duration=longest,volume=0.08,aecho=0.7:0.9:60|120:0.25|0.18,afade=t=in:d=0.5,afade=t=out:st=7.45:d=0.8[bg];\
    [3]volume=0.22,afade=t=out:d=0.12,adelay=1000|1000[click];\
    [4]volume=0.15,afade=t=out:d=0.08,adelay=2500|2500[t1];\
    [5]volume=0.15,afade=t=out:d=0.08,adelay=3500|3500[t2];\
    [6]volume=0.15,afade=t=out:d=0.08,adelay=4500|4500[t3];\
    [7]volume=0.18,afade=t=out:d=0.3,adelay=6500|6500[c1];\
    [8]volume=0.16,afade=t=out:d=0.3,adelay=6700|6700[c2];\
    [9]volume=0.15,afade=t=out:d=0.4,adelay=6900|6900[c3];\
    [bg][click][t1][t2][t3][c1][c2][c3]amix=inputs=8:duration=longest:normalize=0[aout]" \
  -map "[aout]" \
  -t "$TOTAL_DUR" \
  -c:a aac -b:a 160k \
  "$OUT/.audio-only.m4a"

# ---------- stage 3: mux --------------------------------------------------
echo "[3/3] Muxing video + audio..."
"$FFMPEG" -y \
  -i "$OUT/.video-only.mp4" \
  -i "$OUT/.audio-only.m4a" \
  -c:v copy -c:a copy \
  -shortest \
  "$OUT/demo-per-tab.mp4"

rm -f "$OUT/.video-only.mp4" "$OUT/.audio-only.m4a"

echo ""
echo "Output:"
ls -lh "$OUT/demo-per-tab.mp4" | awk '{print $5, $NF}'
"$FFMPEG" -i "$OUT/demo-per-tab.mp4" 2>&1 | grep -E "Duration|Stream" | head -4
