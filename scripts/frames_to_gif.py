"""Stitches PNG frames into an optimized GIF (used by make-readme-media.mjs).

Frame files are named NNNN-H.png, where H is how many base ticks (100 ms) to hold the frame.
Identical consecutive frames are merged. Requires Pillow.

    python -I scripts/frames_to_gif.py <frames_dir> <out.gif>
"""
import sys
from pathlib import Path

from PIL import Image, ImageChops

TICK_MS = 100
WIDTH = 360


def main(src: str, out: str) -> None:
    files = sorted(Path(src).glob("*.png"))
    frames: list[Image.Image] = []
    durations: list[int] = []
    for f in files:
        hold = int(f.stem.split("-")[1])
        img = Image.open(f).convert("RGB")
        img = img.resize((WIDTH, round(img.height * WIDTH / img.width)), Image.LANCZOS)
        if frames and ImageChops.difference(frames[-1], img).getbbox() is None:
            durations[-1] += hold * TICK_MS
            continue
        frames.append(img)
        durations.append(hold * TICK_MS)
    # One shared adaptive palette keeps colors steady between frames (flat cartoon art).
    palette = frames[len(frames) // 2].quantize(colors=255, method=Image.Quantize.MEDIANCUT)
    paletted = [f.quantize(palette=palette, dither=Image.Dither.NONE) for f in frames]
    paletted[0].save(out, save_all=True, append_images=paletted[1:], duration=durations, loop=0, optimize=True, disposal=1)
    print(f"wrote {out}: {len(paletted)} frames, {sum(durations) / 1000:.1f}s, {Path(out).stat().st_size / 1024:.0f} KB")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
