#!/usr/bin/env bash
# Builds the v2 store/website demo video from frames made by
#   node tools/store-assets.mjs --video
# Each scene = its slide background + the popup frame sequence overlaid on the
# slab; scenes are joined with short crossfades and end on a brand card.
#
# Audio reuses the v1 demo's three YouTube tracks in tools/audio (gitignored):
# tab1 = music, tab2 = audiobook narration, tab3 = documentary. Each track's
# volume follows the sliders on screen, using the click/drag timings that
# store-assets.mjs records in frames/manifest.json, plus UI clicks and an end
# chime. NOTE: these are third-party YouTube audio; uploading the video to
# YouTube may get a Content ID claim.
#
#   tools/build-store-video.sh             # 1280x720 store/YouTube video with headlines
#   tools/build-store-video.sh --portrait  # popup-only 760x1200 cut for the website's video slot
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
FFMPEG="$ROOT/tools/node_modules/ffmpeg-static/ffmpeg"
FRAMES="$ROOT/marketing/v2/frames"
OUT="$ROOT/marketing/v2/video"
AUDIO_DIR="$ROOT/tools/audio"
AUDIO_SS=30
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
mkdir -p "$OUT"

FADE=0.35
END_HOLD=2.5
PORTRAIT=0; [[ "${1:-}" == "--portrait" ]] && PORTRAIT=1

# Pull layout + scene list from the manifest written by store-assets.mjs.
read -r FPS PX PY PW PH < <(python3 -c "
import json; m=json.load(open('$FRAMES/manifest.json')); p=m['popup']
print(m['fps'], p['x'], p['y'], p['w'], p['visibleH'])")
mapfile -t SCENES < <(python3 -c "
import json; [print(s['id'], s['seconds']) for s in json.load(open('$FRAMES/manifest.json'))['scenes']]")

echo "[1/3] Rendering ${#SCENES[@]} scenes..."
CLIPS=() DURS=()
for entry in "${SCENES[@]}"; do
  read -r ID SECS <<<"$entry"
  if (( PORTRAIT )); then
    "$FFMPEG" -v error -y -framerate "$FPS" -i "$FRAMES/$ID/%04d.png" \
      -vf format=yuv420p -r "$FPS" -c:v libx264 -preset medium -crf 18 "$TMP/$ID.mp4"
  else
  "$FFMPEG" -v error -y \
    -loop 1 -framerate "$FPS" -i "$FRAMES/$ID/bg.png" \
    -framerate "$FPS" -i "$FRAMES/$ID/%04d.png" \
    -filter_complex "[1:v]scale=${PW}:-2:flags=lanczos,crop=${PW}:${PH}:0:0[p];[0:v][p]overlay=${PX}:${PY}:shortest=1,format=yuv420p[v]" \
    -map "[v]" -r "$FPS" -c:v libx264 -preset medium -crf 18 "$TMP/$ID.mp4"
  fi
  CLIPS+=("$TMP/$ID.mp4"); DURS+=("$SECS")
done
END_VF="format=yuv420p"
# Portrait: centre the landscape end card on an ink background at popup size.
(( PORTRAIT )) && END_VF="scale=760:-2,pad=760:1200:0:(oh-ih)/2:color=0x141210,format=yuv420p"
"$FFMPEG" -v error -y -loop 1 -framerate "$FPS" -t "$END_HOLD" -i "$FRAMES/end.png" \
  -vf "$END_VF" -r "$FPS" -c:v libx264 -preset medium -crf 18 "$TMP/end.mp4"
CLIPS+=("$TMP/end.mp4"); DURS+=("$END_HOLD")

echo "[2/3] Joining with crossfades..."
INPUTS=() ; for c in "${CLIPS[@]}"; do INPUTS+=(-i "$c"); done
FILTER=$(python3 - "$FADE" "${DURS[@]}" <<'PY'
import sys
fade=float(sys.argv[1]); d=[float(x) for x in sys.argv[2:]]
parts=[]; prev='[0:v]'; t=0.0
for i in range(1,len(d)):
    t += d[i-1] - fade
    out = '[v]' if i == len(d)-1 else f'[x{i}]'
    parts.append(f'{prev}[{i}:v]xfade=transition=fade:duration={fade}:offset={t:.3f}{out}')
    prev = out
print(';'.join(parts))
PY
)
TOTAL=$(python3 -c "import sys; d=[float(x) for x in sys.argv[2:]]; print(round(sum(d)-float(sys.argv[1])*(len(d)-1),3))" "$FADE" "${DURS[@]}")

for t in tab1 tab2 tab3; do
  [[ -f "$AUDIO_DIR/$t-full.m4a" ]] || { echo "Missing $AUDIO_DIR/$t-full.m4a (video needs sound)" >&2; exit 1; }
done
A0=${#CLIPS[@]}   # index of the first audio input
AUDIO=(
  -ss "$AUDIO_SS" -t "$TOTAL" -i "$AUDIO_DIR/tab1-full.m4a"
  -ss "$AUDIO_SS" -t "$TOTAL" -i "$AUDIO_DIR/tab2-full.m4a"
  -ss "$AUDIO_SS" -t "$TOTAL" -i "$AUDIO_DIR/tab3-full.m4a"
  -f lavfi -i "sine=f=880:d=0.08"
  -f lavfi -i "sine=f=440:d=0.3"
  -f lavfi -i "sine=f=554.37:d=0.3"
  -f lavfi -i "sine=f=659.25:d=0.4"
)
AMAP=$(python3 - "$FRAMES/manifest.json" "$FADE" "$TOTAL" "$A0" "$END_HOLD" <<'PY'
import json, sys
m = json.load(open(sys.argv[1])); fade = float(sys.argv[2]); total = float(sys.argv[3])
a0 = int(sys.argv[4]); end_hold = float(sys.argv[5])
scenes = m['scenes']
# Absolute start of each scene after crossfades (scene i starts where i-1 fades out).
starts, t = [], 0.0
for sc in scenes:
    starts.append(t); t += sc['seconds'] - fade
end_start = t
by_id = {sc['id']: (st, sc) for st, sc in zip(starts, scenes)}

def ev(scene_id, kind, **match):
    st, sc = by_id[scene_id]
    for e in sc['events']:
        if e['type'] == kind and all(e.get(k) == v for k, v in match.items()):
            return st, e
    raise SystemExit(f'missing event {kind} {match} in {scene_id}')

# Keypoints (time, gain) per track, linearly interpolated.
music, narr, doc = [(0, 1.0)], [(0, 0.0)], [(0, 0.0)]
st, e = ev('1-per-site', 'ramp', track='music')          # YouTube slider 100% -> 30%
music += [(st + e['t'], e['from']), (st + e['end'], e['to'])]
st4, tabs = ev('4-per-tab', 'tabs')                       # three tabs start at 40%
t4 = st4 + tabs['t']
music += [(t4, 0.3), (t4 + 0.2, 0.4)]
narr += [(t4, 0.0), (t4 + 0.2, 0.4)]
doc += [(t4, 0.0), (t4 + 0.2, 0.4)]
st, e = ev('4-per-tab', 'ramp', track='music')            # tab 1 up to 70%
music += [(st + e['t'], e['from']), (st + e['end'], e['to'])]
st, e = ev('4-per-tab', 'ramp', track='narration')        # tab 2 down to 15%
narr += [(st + e['t'], e['from']), (st + e['end'], e['to'])]
st5 = by_id['5-pricing'][0]                               # back to one quiet track
music += [(st5, 0.7), (st5 + 0.5, 0.3), (total - 1.0, 0.3), (total, 0.0)]
narr += [(st5, 0.15), (st5 + 0.5, 0.0)]
doc += [(st5, 0.4), (st5 + 0.5, 0.0)]

def expr(points):
    pts = sorted(points)
    out = f'{pts[-1][1]}'
    for (t0, v0), (t1, v1) in reversed(list(zip(pts, pts[1:]))):
        seg = f'{v0}' if t1 - t0 < 1e-6 else f'({v0}+({v1}-{v0})*(t-{t0:.3f})/{t1 - t0:.3f})'
        out = f'if(lt(t,{t1:.3f}),{seg},{out})'
    return f'if(lt(t,{pts[0][0]:.3f}),{pts[0][1]},{out})'

clicks = [st + e['t'] for st, sc in zip(starts, scenes) for e in sc['events'] if e['type'] == 'click']
parts = [
    f"[{a0}:a]volume='{expr(music)}':eval=frame[t1]",
    f"[{a0+1}:a]volume='{expr(narr)}':eval=frame[t2]",
    f"[{a0+2}:a]volume='{expr(doc)}':eval=frame[t3]",
    f"[{a0+3}:a]volume=0.35,afade=t=out:d=0.08,asplit={len(clicks)}" + ''.join(f'[c{i}]' for i in range(len(clicks))),
]
for i, c in enumerate(clicks):
    ms = int(c * 1000); parts.append(f'[c{i}]adelay={ms}|{ms}[k{i}]')
ec = int(end_start * 1000)
parts += [f'[{a0+4}:a]volume=0.22,afade=t=out:d=0.3,adelay={ec}|{ec}[e1]',
          f'[{a0+5}:a]volume=0.20,afade=t=out:d=0.3,adelay={ec+200}|{ec+200}[e2]',
          f'[{a0+6}:a]volume=0.18,afade=t=out:d=0.4,adelay={ec+400}|{ec+400}[e3]']
mix = '[t1][t2][t3]' + ''.join(f'[k{i}]' for i in range(len(clicks))) + '[e1][e2][e3]'
n = 3 + len(clicks) + 3
parts.append(f'{mix}amix=inputs={n}:duration=longest:normalize=0,'
             f'alimiter=limit=0.97:attack=5:release=50,volume=1.8,'
             f'afade=t=in:d=0.3,afade=t=out:st={total-0.4:.3f}:d=0.4[a]')
print(';'.join(parts))
PY
)

NAME=volux-demo-1280x720.mp4; (( PORTRAIT )) && NAME=volux-demo-portrait-760x1200.mp4
echo "[3/3] Encoding ${TOTAL}s video ($NAME)..."
"$FFMPEG" -v error -y "${INPUTS[@]}" "${AUDIO[@]}" \
  -filter_complex "$FILTER;$AMAP" -map "[v]" -map "[a]" -t "$TOTAL" \
  -c:v libx264 -preset slow -crf 20 -pix_fmt yuv420p -movflags +faststart \
  -c:a aac -b:a 160k -ac 2 -ar 44100 "$OUT/$NAME"

ls -lh "$OUT/$NAME" | awk '{print $5, $NF}'
