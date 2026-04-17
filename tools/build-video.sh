#!/usr/bin/env bash
# Builds the Volux per-tab demo video with real YouTube audio.
# Each tab's audio track has a per-frame volume expression that literally
# tracks the slider value — viewer SEES and HEARS the per-tab control.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
FFMPEG="$ROOT/tools/node_modules/ffmpeg-static/ffmpeg"
FRAMES="$ROOT/tools/frames"
AUDIO="$ROOT/tools/audio"
OUT="$ROOT/marketing/generated"
CAPS="$ROOT/tools/captions"
FONT="/usr/share/fonts/truetype/roboto/unhinted/RobotoTTF/Roboto-Bold.ttf"
mkdir -p "$OUT" "$CAPS"

IN_FPS=24
HOLD_END=2.0
TOTAL_DUR=8.25

# ---------- captions ------------------------------------------------------
render_caption() {
  local text="$1" out="$2" size="${3:-32}"
  convert -size 760x90 xc:transparent \
    -gravity center \
    -fill "#000000cc" -draw "roundrectangle 120,18 640,72 28,28" \
    -font "$FONT" -pointsize "$size" -fill white \
    -annotate 0 "$text" \
    "$out"
}
render_caption "Three YouTube tabs — all at 40%"           "$CAPS/cap1.png" 28
render_caption "Pro: drag each tab to its own volume"       "$CAPS/cap2.png" 28
render_caption "Mute one — the other two keep playing"      "$CAPS/cap3.png" 26
render_caption "Volux Pro  ·  per-tab volume  ·  \$2 one-time" "$CAPS/cap4.png" 26

# ---------- volume automation curves --------------------------------------
# Each curve mirrors what the slider visually does.
# Tab 1 (Western music):  40% → 90% at 1.5-2.25s → held → muted 4.5s → reset 5.25s
TAB1_VOL="if(lt(t,1.5),0.40,if(lt(t,2.25),0.40+0.666*(t-1.5),if(lt(t,4.5),0.90,if(lt(t,4.6),0.90-9.0*(t-4.5),if(lt(t,5.25),0,if(lt(t,5.35),4.0*(t-5.25),0.40))))))"

# Tab 2 (audiobook narration):  40% → 15% at 2.5-3.25s, then held
TAB2_VOL="if(lt(t,2.5),0.40,if(lt(t,3.25),0.40-0.333*(t-2.5),0.15))"

# Tab 3 (space documentary):  40% → 65% at 3.5-4.25s, then held
TAB3_VOL="if(lt(t,3.5),0.40,if(lt(t,4.25),0.40+0.333*(t-3.5),0.65))"

# ---------- stage 1: silent video with captions ---------------------------
echo "[1/3] Encoding video layer..."
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

# ---------- stage 2: audio with per-tab volume automation -----------------
echo "[2/3] Encoding audio layer (YouTube audio + per-tab automation)..."
"$FFMPEG" -y \
  -i "$AUDIO/tab1.m4a" \
  -i "$AUDIO/tab2.m4a" \
  -i "$AUDIO/tab3.m4a" \
  -f lavfi -i "sine=f=880:d=0.1" \
  -f lavfi -i "sine=f=440:d=0.3" \
  -f lavfi -i "sine=f=554.37:d=0.3" \
  -f lavfi -i "sine=f=659.25:d=0.4" \
  -filter_complex "\
    [0:a]volume='${TAB1_VOL}':eval=frame[t1];\
    [1:a]volume='${TAB2_VOL}':eval=frame[t2];\
    [2:a]volume='${TAB3_VOL}':eval=frame[t3];\
    [3:a]volume=0.35,afade=t=out:d=0.1,adelay=1000|1000[clk];\
    [4:a]volume=0.22,afade=t=out:d=0.3,adelay=6500|6500[ec1];\
    [5:a]volume=0.20,afade=t=out:d=0.3,adelay=6700|6700[ec2];\
    [6:a]volume=0.18,afade=t=out:d=0.4,adelay=6900|6900[ec3];\
    [t1][t2][t3][clk][ec1][ec2][ec3]amix=inputs=7:duration=longest:normalize=0[pre];\
    [pre]alimiter=limit=0.97:attack=5:release=50,volume=1.8,afade=t=in:d=0.3,afade=t=out:st=7.85:d=0.4[aout]" \
  -map "[aout]" \
  -t "$TOTAL_DUR" \
  -c:a aac -b:a 192k -ar 44100 -ac 2 \
  "$OUT/.audio-only.m4a"

# ---------- stage 3: mux --------------------------------------------------
echo "[3/3] Muxing..."
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
