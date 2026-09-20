import { runFfprobe } from "./ffmpeg.js";
import type { MediaInfo } from "./types.js";

function parseFps(rate: string | undefined): number {
  if (!rate) return 0;
  const [n, d] = rate.split("/").map(Number);
  if (!n) return 0;
  return d ? n / d : n;
}

/** ffprobe the final cut; a video stream and an audio stream are required. */
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
  if (!video) throw new Error("Input has no video stream — mg-setup needs the final-cut video.");
  if (!audio) throw new Error("Input has no audio stream — the final cut must carry its audio.");

  return {
    width: Number(video.width),
    height: Number(video.height),
    fps: parseFps(video.r_frame_rate as string | undefined),
    duration: Number(data.format?.duration ?? 0),
    pixFmt: String(video.pix_fmt ?? ""),
    videoCodec: String(video.codec_name ?? ""),
    hasAudio: true,
  };
}
