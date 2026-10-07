from __future__ import annotations

import argparse
from pathlib import Path
from PIL import Image


def main() -> None:
    parser = argparse.ArgumentParser(description="Build Chanlume preview GIF from deterministic PNG frames.")
    parser.add_argument("frames", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("--width", type=int, default=800)
    parser.add_argument("--duration", type=int, default=83, help="Milliseconds per frame")
    args = parser.parse_args()

    paths = sorted(args.frames.glob("frame-*.png"))
    if not paths:
        raise SystemExit("No frames found")

    rgba_frames: list[Image.Image] = []
    for path in paths:
        with Image.open(path) as source:
            height = round(source.height * args.width / source.width)
            rgba_frames.append(source.convert("RGB").resize((args.width, height), Image.Resampling.LANCZOS))

    # Build one shared palette from all frames so transitions keep stable colors.
    samples = [frame.resize((160, 90), Image.Resampling.BILINEAR) for frame in rgba_frames]
    sheet = Image.new("RGB", (160 * 12, 90 * ((len(samples) + 11) // 12)))
    for index, sample in enumerate(samples):
        sheet.paste(sample, ((index % 12) * 160, (index // 12) * 90))
    palette = sheet.quantize(colors=192, method=Image.Quantize.MEDIANCUT)
    frames = [frame.quantize(palette=palette, dither=Image.Dither.FLOYDSTEINBERG) for frame in rgba_frames]

    args.output.parent.mkdir(parents=True, exist_ok=True)
    frames[0].save(
        args.output,
        save_all=True,
        append_images=frames[1:],
        duration=args.duration,
        loop=0,
        optimize=True,
        disposal=1,
    )


if __name__ == "__main__":
    main()
