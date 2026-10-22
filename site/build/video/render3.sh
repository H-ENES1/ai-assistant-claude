#!/bin/bash
set -e
cd /home/claude/video
export NODE_PATH=/opt/npm-tools/node_modules
for v in "tr " "en " "tr v" "en v"; do
  set -- $v
  tag="$1${2:+-v}"
  node rec3.cjs render $1 $2
  ffmpeg -y -loglevel error -framerate 30 -i frames-$tag/f%04d.jpg -c:v libx264 -pix_fmt yuv420p -crf 20 -preset medium -movflags +faststart tanitim-$tag.mp4
  rm -rf frames-$tag
  echo "bitti $tag $(du -h tanitim-$tag.mp4 | cut -f1)"
done
