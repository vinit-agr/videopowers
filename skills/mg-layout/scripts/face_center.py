#!/usr/bin/env python3
"""Find the host's face center in talking-head footage.

Samples frames evenly across the video, runs OpenCV's Haar frontal-face
detector, takes the largest face per frame, and reports the MEDIAN center as
normalized coordinates. The layout runtime (FootageStage) uses this to place
cropped layouts (Split card, Bubble) so the face sits dead center.

  python3 face_center.py <video> [--samples 15] [--out face.json]

Writes/prints: {"x": 0.47, "y": 0.42, "detections": 14, "samples": 15}
Fails (exit 1) if fewer than 3 frames had a detectable face — never writes a
guess. Requires opencv-python-headless (pip install opencv-python-headless).
"""
import argparse
import json
import statistics
import sys

try:
    import cv2
except ImportError:
    sys.exit("error: opencv not installed — run: pip3 install opencv-python-headless")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("video")
    ap.add_argument("--samples", type=int, default=15)
    ap.add_argument("--out", default=None, help="write JSON here (else stdout only)")
    args = ap.parse_args()

    cap = cv2.VideoCapture(args.video)
    if not cap.isOpened():
        sys.exit(f"error: cannot open {args.video}")
    total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    width = cap.get(cv2.CAP_PROP_FRAME_WIDTH)
    height = cap.get(cv2.CAP_PROP_FRAME_HEIGHT)
    if total <= 0 or width <= 0 or height <= 0:
        sys.exit("error: could not read video dimensions/frame count")

    cascade = cv2.CascadeClassifier(cv2.data.haarcascades + "haarcascade_frontalface_default.xml")
    xs, ys = [], []
    # Skip the first/last 5% (fades, black chapter gaps at the edges).
    lo, hi = int(total * 0.05), int(total * 0.95)
    step = max(1, (hi - lo) // args.samples)
    min_size = int(height * 0.08)  # a real talking-head face is ≥8% of frame height

    for idx in range(lo, hi, step):
        cap.set(cv2.CAP_PROP_POS_FRAMES, idx)
        ok, frame = cap.read()
        if not ok:
            continue
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        faces = cascade.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=6, minSize=(min_size, min_size))
        if len(faces) == 0:
            continue
        x, y, w, h = max(faces, key=lambda f: f[2] * f[3])  # largest face
        xs.append((x + w / 2) / width)
        ys.append((y + h / 2) / height)
    cap.release()

    if len(xs) < 3:
        sys.exit(f"error: face detected in only {len(xs)} sampled frame(s) — refusing to guess. "
                 "Is the footage a talking head? Try more --samples.")

    result = {
        "x": round(statistics.median(xs), 4),
        "y": round(statistics.median(ys), 4),
        "detections": len(xs),
        "samples": args.samples,
    }
    out = json.dumps(result, indent=2) + "\n"
    if args.out:
        with open(args.out, "w") as f:
            f.write(out)
    print(out, end="")


if __name__ == "__main__":
    main()
