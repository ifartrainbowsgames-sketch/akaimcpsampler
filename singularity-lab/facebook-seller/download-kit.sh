#!/bin/bash
# Copy Facebook seller kit to ~/singularity lab on your PC or tablet (Ubuntu)
set -e
BASE="https://raw.githubusercontent.com/ifartrainbowsgames-sketch/akaimcpsampler/cursor/facebook-seller-kit-d00f/singularity-lab/facebook-seller"
DEST="$HOME/singularity lab/facebook-seller"
mkdir -p "$DEST"
for f in README.md SETUP-FAP.md SETUP-FB-TOOL.md SETUP-MARKETPLACE-BOT.md post-template-en.txt post-template-th.txt groups-keywords.txt groups-to-join.txt actions-join-groups.csv actions-post-schedule.csv .env.example; do
  curl -fsSL "$BASE/$f" -o "$DEST/$f"
done
echo "Done. Files in: $DEST"
ls -la "$DEST"
