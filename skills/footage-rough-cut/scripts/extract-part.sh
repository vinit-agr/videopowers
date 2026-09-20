#!/bin/bash
# extract-part.sh <project-dir> <N> [--delete-bundle]
#
# Export camera+mic from <project-dir>/part<N>.screenstudio into
# <project-dir>/assets/camera/part<N>.mp4 as verified CFR-30, without needing
# a Screen Studio export. Reads the HLS webcam stream and the mic m4a straight
# from the bundle (all channels share one wall clock, so zeroing video PTS
# aligns A/V exactly). Tolerates a corrupt/missing "enhanced" mic.
#
# The bundle is only deleted when --delete-bundle is passed AND every
# verification check passed.
set -euo pipefail

BASE="${1:?usage: extract-part.sh <project-dir> <N> [--delete-bundle]}"
N="${2:?usage: extract-part.sh <project-dir> <N> [--delete-bundle]}"
DELETE="${3:-}"
BASE="$(cd "$BASE" && pwd)"
REC="$BASE/part$N.screenstudio/recording"
OUTDIR="$BASE/assets/camera"
OUT="$OUTDIR/part$N.mp4"

[ -d "$REC" ] || { echo "error: $BASE/part$N.screenstudio not found" >&2; exit 1; }
mkdir -p "$OUTDIR"

# Screen Studio numbers channels by what was recorded that session (e.g. webcam
# has been channel-4 in one shoot and channel-3 in another) — locate streams by
# role, not by channel number.
WEBCAM=$(ls "$REC"/channel-*-webcam-0.m3u8 2>/dev/null | head -1)
MIC=$(ls "$REC"/channel-*-microphone-0.m4a 2>/dev/null | head -1)
ENH=$(ls "$REC"/enhanced/channel-*-microphone-0-enhanced.m4a 2>/dev/null | head -1)
[ -n "$WEBCAM" ] || { echo "error: no webcam m3u8 found in $REC" >&2; exit 1; }
[ -n "$MIC" ] || { echo "error: no microphone m4a found in $REC" >&2; exit 1; }
[ -n "$ENH" ] || ENH="$REC/enhanced/__missing__"

expected=$(python3 -c "import json; print(json.load(open('$BASE/part$N.screenstudio/project.json'))['json']['config']['recordingRange'][1]/1000)")
echo "[part$N] expected duration: ${expected}s"

COMMON_IN=(-i "$WEBCAM" -i "$MIC")
COMMON_OUT=(-vf "setpts=PTS-STARTPTS,fps=30:round=near" \
  -c:v h264_videotoolbox -b:v 26M -profile:v high -c:a copy \
  -metadata:s:a:0 title="mic raw" \
  -video_track_timescale 30000 -movflags +faststart "$OUT")

if ffprobe -v error -show_entries stream=codec_name "$ENH" >/dev/null 2>&1; then
  ATRACKS=2
  ffmpeg -hide_banner -loglevel error -y "${COMMON_IN[@]}" -i "$ENH" \
    -map 0:v -map 1:a -map 2:a \
    -metadata:s:a:1 title="mic enhanced" -disposition:a:0 default -disposition:a:1 0 \
    "${COMMON_OUT[@]}"
else
  ATRACKS=1
  echo "[part$N] WARNING: enhanced mic unreadable — exporting raw mic only"
  ffmpeg -hide_banner -loglevel error -y "${COMMON_IN[@]}" \
    -map 0:v -map 1:a \
    "${COMMON_OUT[@]}"
fi
echo "[part$N] export done ($ATRACKS audio track(s))"

python3 - "$OUT" "$expected" "$ATRACKS" <<'PY'
import json, subprocess, sys
out, expected, atracks = sys.argv[1], float(sys.argv[2]), int(sys.argv[3])
d = json.loads(subprocess.run(
    ["ffprobe", "-v", "error", "-show_streams", "-of", "json", out],
    capture_output=True, text=True).stdout)
v = [s for s in d["streams"] if s["codec_type"] == "video"][0]
a = [s for s in d["streams"] if s["codec_type"] == "audio"]
assert v["r_frame_rate"] == "30/1" and v["avg_frame_rate"] == "30/1", f"not CFR30: {v['r_frame_rate']}/{v['avg_frame_rate']}"
vd = float(v["duration"])
assert abs(vd - expected) < 0.15, f"video dur {vd} vs expected {expected}"
assert len(a) == atracks, f"expected {atracks} audio tracks, got {len(a)}"
for s in a:
    assert abs(float(s["duration"]) - vd) < 0.15, "audio/video duration mismatch"
print(f"verify OK: {vd:.2f}s, CFR30, {len(a)} audio track(s)")
PY
echo "[part$N] verify passed"

if [ "$DELETE" = "--delete-bundle" ]; then
  rm -rf "$BASE/part$N.screenstudio"
  echo "[part$N] bundle deleted — DONE"
else
  echo "[part$N] DONE (bundle kept; pass --delete-bundle to remove it after verification)"
fi
