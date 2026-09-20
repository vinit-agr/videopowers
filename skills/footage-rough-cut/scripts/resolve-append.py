#!/usr/bin/env python3
"""Place a rough-cut plan into DaVinci Resolve as trimmable timeline clips.

Bridge mode of the footage-rough-cut skill. Reads rough-cut.plan.json and either
creates a new timeline (--new-timeline) or appends behind the last clip of an
existing one (--timeline). Every kept segment becomes one clip with full trim
handles; beat gaps become empty (black) timeline space.

Battle-tested rules from the harness-video production are baked in:
  - refuse to run unless the project playback rate matches the plan fps
    (the rate is NOT script-writable; a wrong rate plays 1.25x slow)
  - append in chunks of <=100 and verify by PLAYHEAD SAMPLING, not
    GetItemListInTrack (which silently caps at 500 items and then lies)
  - SaveProject after every chunk (crash insurance)
  - never touch existing timeline items, never delete tracks
"""
import argparse
import json
import os
import sys
import time
from pathlib import Path

DEFAULT_VENDOR = Path(__file__).resolve().parent.parent / "vendor/davinci-resolve-mcp"
CHUNK = 100
CONNECT_RETRY_S = 5
CONNECT_TIMEOUT_S = 300

ONBOARDING = """
────────────────────────────────────────────────────────────────────
  DaVinci Resolve bridge mode

  Before this can run, Resolve must be open with its scripting bridge
  active. If you haven't already:

    1. Open DaVinci Resolve, and open the project the rough cut
       should land in.
    2. In Resolve's menu bar:  Workspace → Scripts → resolve_bridge
       (this starts the in-app bridge; nothing visible happens —
       that's normal)
    3. That's it — come back here. I'll connect automatically.

  While clips are being placed (a minute or two), please don't click
  around inside Resolve: an open dialog or an active edit blocks the
  scripting API mid-write. I'll tell you the moment it's done.
────────────────────────────────────────────────────────────────────
"""


def die(msg):
    print(f"\nerror: {msg}", file=sys.stderr)
    sys.exit(1)


def frames_to_tc(frame, fps):
    fps = int(round(fps))
    f = frame % fps
    s = (frame // fps) % 60
    m = (frame // (fps * 60)) % 60
    h = frame // (fps * 3600)
    return f"{h:02d}:{m:02d}:{s:02d}:{f:02d}"


def connect_with_patience(vendor):
    sys.path.insert(0, str(vendor))
    os.environ.setdefault("DAVINCI_RESOLVE_BRIDGE", "1")
    from src.utils.resolve_bridge_client import connect  # noqa: E402

    print(ONBOARDING)
    print(f"Waiting for the bridge (checking every {CONNECT_RETRY_S}s, up to "
          f"{CONNECT_TIMEOUT_S // 60} minutes)…", flush=True)
    deadline = time.time() + CONNECT_TIMEOUT_S
    attempt = 0
    while True:
        attempt += 1
        try:
            resolve = connect()
            if resolve is not None:
                print(f"✓ connected to Resolve (attempt {attempt})\n")
                return resolve
        except Exception:
            pass
        if time.time() > deadline:
            die("could not reach the Resolve bridge after 5 minutes.\n"
                "  Is Resolve open? Is Workspace → Scripts → resolve_bridge running?\n"
                "  Start it and re-run this command.")
        time.sleep(CONNECT_RETRY_S)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("plan", help="rough-cut.plan.json")
    group = ap.add_mutually_exclusive_group(required=True)
    group.add_argument("--new-timeline", help="create this timeline and place the plan at 0")
    group.add_argument("--timeline", help="append the plan behind the last clip of this existing timeline")
    ap.add_argument("--bin", default="camera", help="media pool bin for the part clips")
    ap.add_argument("--vendor", default=os.environ.get("RESOLVE_BRIDGE_VENDOR", str(DEFAULT_VENDOR)),
                    help="davinci-resolve-mcp checkout (env RESOLVE_BRIDGE_VENDOR)")
    args = ap.parse_args()

    plan = json.load(open(args.plan))
    fps = int(round(plan["fps"]))
    for part in plan["parts"]:
        if not Path(part["path"]).exists():
            die(f"part missing on disk: {part['path']}")

    vendor = Path(args.vendor)
    if not (vendor / "src/utils/resolve_bridge_client.py").exists():
        die(f"Resolve bridge client not found at {vendor}\n"
            "  Set RESOLVE_BRIDGE_VENDOR to your davinci-resolve-mcp checkout.")

    resolve = connect_with_patience(vendor)
    proj = resolve.GetProjectManager().GetCurrentProject()
    print("project:", proj.GetName())
    pfr = str(proj.GetSetting("timelinePlaybackFrameRate"))
    if pfr not in (str(fps), f"{fps}.0"):
        die(f"project playback frame rate is {pfr!r}, but the plan is {fps} fps.\n"
            "  Set it by hand once: Project Settings → Master Settings → Timeline frame rate\n"
            "  (this setting is not script-writable), then re-run.")

    media_pool = proj.GetMediaPool()

    # --- media pool bin + part clips ---
    root = media_pool.GetRootFolder()
    target = None
    for sub in root.GetSubFolderList() or []:
        if sub.GetName() == args.bin:
            target = sub
            break
    if target is None:
        target = media_pool.AddSubFolder(root, args.bin)
        if not target:
            die(f"could not create media pool bin {args.bin!r}")
        print(f"created bin: {args.bin}")
    media_pool.SetCurrentFolder(target)
    existing = {}
    for clip in target.GetClipList() or []:
        fp = clip.GetClipProperty("File Path")
        if fp:
            existing[str(Path(fp).resolve())] = clip
    items = {}
    for part in plan["parts"]:
        key = str(Path(part["path"]).resolve())
        if key in existing:
            items[part["index"]] = existing[key]
        else:
            imported = media_pool.ImportMedia([key])
            if not imported:
                die(f"ImportMedia failed: {key}")
            items[part["index"]] = imported[0]
            print(f"imported: {Path(key).name}")
        got = str(items[part["index"]].GetClipProperty("FPS"))
        if got not in (str(fps), f"{fps}.0"):
            die(f"{Path(key).name}: ingested FPS={got!r}, expected {fps}")

    # --- timeline ---
    if args.new_timeline:
        tl = media_pool.CreateEmptyTimeline(args.new_timeline)
        if not tl:
            die(f"could not create timeline {args.new_timeline!r} (name already taken?)")
        proj.SetCurrentTimeline(tl)
        base = int(tl.GetStartFrame() or 0)
        print(f"created timeline {args.new_timeline!r} (start frame {base})")
    else:
        tl = None
        for i in range(1, int(proj.GetTimelineCount() or 0) + 1):
            t = proj.GetTimelineByIndex(float(i))
            if t and t.GetName() == args.timeline:
                tl = t
                break
        if not tl:
            die(f"timeline {args.timeline!r} not found")
        proj.SetCurrentTimeline(tl)
        before = tl.GetItemListInTrack("video", 1.0) or []
        if not before:
            die("timeline has no items — use --new-timeline for an empty start")
        gap = int(round(2.0 * fps))
        base = int(before[-1].GetEnd()) + gap
        print(f"appending behind existing clips at abs frame {base}")

    # --- clip infos from the plan ---
    clip_infos = []
    for seg in plan["segments"]:
        if seg["kind"] != "clip":
            continue  # black gaps are just empty record space
        clip_infos.append({
            "mediaPoolItem": items[seg["part"]],
            "startFrame": int(seg["startFrame"]),
            "endFrame": int(seg["endFrame"]),          # exclusive
            "recordFrame": base + int(seg["recordFrame"]),
            "trackIndex": 1,
        })
    print(f"placing {len(clip_infos)} clips "
          f"({sum(1 for s in plan['segments'] if s['kind'] == 'black')} beat gaps as empty space)…")

    # --- chunked append + playhead-sampled verification ---
    placed = 0
    for lo in range(0, len(clip_infos), CHUNK):
        chunk = clip_infos[lo:lo + CHUNK]
        ok = media_pool.AppendToTimeline(chunk)
        if not ok:
            die(f"AppendToTimeline returned falsy for clips {lo}..{lo + len(chunk) - 1} — "
                "check nothing is blocking Resolve (dialogs, active edits)")
        first = chunk[0]["recordFrame"]
        tl.SetCurrentTimecode(frames_to_tc(first, fps))
        item = tl.GetCurrentVideoItem()
        got = int(item.GetStart()) if item else -1
        if got != first:
            die(f"verification failed: expected a clip starting at abs frame {first}, "
                f"playhead sees {got} — inspect the timeline in Resolve before re-running")
        placed += len(chunk)
        resolve.GetProjectManager().SaveProject()
        print(f"  {placed}/{len(clip_infos)} placed (verified, saved)")

    end_frame = clip_infos[-1]["recordFrame"] + (clip_infos[-1]["endFrame"] - clip_infos[-1]["startFrame"])
    print(f"\n✓ done — timeline ends at {(end_frame - int(tl.GetStartFrame() or 0)) / fps:.1f}s. "
          "You can use Resolve again now.")


if __name__ == "__main__":
    main()
