#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
FF=/tmp/tools/node_modules/ffmpeg-static/ffmpeg
DIR=public/videos/tanitim
NORM=/tmp/jako-norm
mkdir -p "$NORM"
FADE=0.4

files=("$DIR"/0*.mp4)
n=${#files[@]}

for i in "${!files[@]}"; do
  "$FF" -y -loglevel error -i "${files[$i]}" \
    -vf "scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2,fps=24,format=yuv420p,eq=contrast=1.02:saturation=1.03" \
    -af "aresample=48000,aformat=channel_layouts=stereo,loudnorm=I=-16:TP=-1.5:LRA=7" \
    -c:v libx264 -preset fast -crf 18 -c:a aac -b:a 192k -t 8 "$NORM/$i.mp4"
done

inputs=()
for i in $(seq 0 $((n-1))); do inputs+=(-i "$NORM/$i.mp4"); done

filter=""
vprev="[0:v]"; aprev="[0:a]"; offset=0
for i in $(seq 1 $((n-1))); do
  offset=$(awk "BEGIN{print $offset + 8 - $FADE}")
  filter+="${vprev}[$i:v]xfade=transition=fade:duration=$FADE:offset=$offset[v$i];"
  filter+="${aprev}[$i:a]acrossfade=d=$FADE:c1=tri:c2=tri[a$i];"
  vprev="[v$i]"; aprev="[a$i]"
done
total=$(awk "BEGIN{print $offset + 8}")
fadeout=$(awk "BEGIN{print $total - 0.8}")
filter+="${vprev}fade=t=in:st=0:d=0.5,fade=t=out:st=$fadeout:d=0.8[vout];"
filter+="${aprev}afade=t=in:st=0:d=0.3,afade=t=out:st=$fadeout:d=0.8[aout]"

"$FF" -y -loglevel error "${inputs[@]}" -filter_complex "$filter" -map "[vout]" -map "[aout]" \
  -c:v libx264 -preset slow -crf 18 -c:a aac -b:a 192k -movflags +faststart public/videos/alkanka-tanitim.mp4
echo "merged: $total s"
