import { runFfprobe } from "./ffmpeg.js";
import type { MediaInfo } from "./types.js";

function parseFps(rate: string | undefined): number {
  if (!rate) return 0;
  const [n, d] = rate.split("/").map(Number);
  if (!n) return 0;
  return d ? n / d : n;
}

/**
 * ffprobe the source into a MediaInfo; throws if there is no audio stream.
 * Video is optional — a bare audio file (mp3/m4a/wav) cleans up fine.
 * Cover-art streams (attached_pic) do not count as video.
 */
export async function probe(path: string): Promise<MediaInfo> {
  const raw = await runFfprobe([
    "-v", "error", "-print_format", "json", "-show_format", "-show_streams", path,
  ]);
  const data = JSON.parse(raw) as {
    streams?: Array<Record<string, unknown>>;
    format?: { duration?: string };
  };
  const streams = data.streams ?? [];
  const video = streams.find(
    (s) =>
      s.codec_type === "video" &&
      !((s.disposition as Record<string, unknown> | undefined)?.attached_pic === 1),
  );
  const audio = streams.find((s) => s.codec_type === "audio");
  if (!audio) throw new Error("Input has no audio stream — nothing to clean up.");

  return {
    width: video ? Number(video.width) : 0,
    height: video ? Number(video.height) : 0,
    fps: parseFps(video?.r_frame_rate as string | undefined),
    fpsRational: video ? String(video.r_frame_rate ?? "") : "",
    hasVideo: Boolean(video),
    hasAudio: true,
    duration: Number(data.format?.duration ?? 0),
  };
}
