import { runFfprobe } from "./ffmpeg.js";

// Post-render A/V sync gate.
//
// Why this exists: a cut-and-join pipeline can produce a file whose audio
// stream CONTAINS more sound than its timestamps CLAIM (extra codec packets
// kept at cut points, timestamps squeezed to hide them). Such a file plays
// fine in timestamp-following players (QuickTime) but drifts cumulatively in
// continuous decoders (Remotion, ffmpeg) — ~20ms of lag per cut. This module
// measures the discrepancies directly and fails the render loudly instead of
// letting a poisoned file ship.

export interface VerifyOptions {
  hasVideo: boolean;
  /** EDL total duration (s) the output should roughly match. */
  expectedDuration: number;
}

interface AudioProbe {
  codec: string;
  sampleRate: number;
  packets: number;
  duration: number;
}

/** Samples of sound per packet for codecs we may emit. */
const SAMPLES_PER_PACKET: Record<string, number> = { aac: 1024 };

async function probeAudio(path: string): Promise<AudioProbe> {
  const raw = await runFfprobe([
    "-v", "error", "-select_streams", "a:0", "-count_packets",
    "-show_entries", "stream=codec_name,sample_rate,nb_read_packets,duration",
    "-print_format", "json", path,
  ]);
  const s = (JSON.parse(raw) as { streams?: Array<Record<string, string>> }).streams?.[0];
  if (!s) throw new Error("verify: output has no audio stream");
  return {
    codec: String(s.codec_name),
    sampleRate: Number(s.sample_rate),
    packets: Number(s.nb_read_packets),
    duration: Number(s.duration),
  };
}

async function probeVideo(path: string): Promise<{ rFps: string; avgFps: string; duration: number }> {
  const raw = await runFfprobe([
    "-v", "error", "-select_streams", "v:0",
    "-show_entries", "stream=r_frame_rate,avg_frame_rate,duration",
    "-print_format", "json", path,
  ]);
  const s = (JSON.parse(raw) as { streams?: Array<Record<string, string>> }).streams?.[0];
  if (!s) throw new Error("verify: output has no video stream");
  return { rFps: String(s.r_frame_rate), avgFps: String(s.avg_frame_rate), duration: Number(s.duration) };
}

function fpsValue(rational: string): number {
  const [n, d] = rational.split("/").map(Number);
  if (!n) return 0;
  return d ? n / d : n;
}

/**
 * Verify the rendered output is sync-safe. Throws (listing every failed check)
 * if not; logs a short PASS report otherwise.
 */
export async function verifyOutput(path: string, opts: VerifyOptions): Promise<void> {
  const failures: string[] = [];
  const audio = await probeAudio(path);

  // 1. Phantom-audio check: actual decoded sound vs the stamped duration.
  //    (AAC priming adds ~1-2 packets, so allow a small constant tolerance.)
  const perPacket = SAMPLES_PER_PACKET[audio.codec];
  let pcmSeconds: number | null = null;
  if (perPacket && audio.sampleRate > 0 && audio.packets > 0) {
    pcmSeconds = (audio.packets * perPacket) / audio.sampleRate;
    const excess = pcmSeconds - audio.duration;
    if (Math.abs(excess) > 0.08) {
      failures.push(
        `audio stream contains ${pcmSeconds.toFixed(3)}s of sound but is stamped ${audio.duration.toFixed(3)}s ` +
          `(${(excess * 1000).toFixed(0)}ms of phantom audio) — would drift in continuous decoders`,
      );
    }
  }

  let video: { rFps: string; avgFps: string; duration: number } | null = null;
  if (opts.hasVideo) {
    video = await probeVideo(path);

    // 2. Constant frame rate: declared and average rates must agree.
    const r = fpsValue(video.rFps);
    const avg = fpsValue(video.avgFps);
    if (r > 0 && avg > 0 && Math.abs(r - avg) / r > 0.002) {
      failures.push(`variable frame rate: declared ${video.rFps} but averages ${video.avgFps}`);
    }

    // 3. Audio and video tracks must be the same length.
    const delta = Math.abs(video.duration - audio.duration);
    if (delta > 0.1) {
      failures.push(
        `A/V track lengths differ by ${(delta * 1000).toFixed(0)}ms ` +
          `(video ${video.duration.toFixed(3)}s vs audio ${audio.duration.toFixed(3)}s)`,
      );
    }
  }

  // 4. Output length should match the cut plan.
  const durDelta = Math.abs(audio.duration - opts.expectedDuration);
  if (durDelta > 0.75) {
    failures.push(
      `output is ${audio.duration.toFixed(2)}s but the cut plan expected ${opts.expectedDuration.toFixed(2)}s`,
    );
  }

  if (failures.length > 0) {
    throw new Error(`output failed A/V sync verification:\n  - ${failures.join("\n  - ")}`);
  }

  const parts = [
    `audio ${audio.duration.toFixed(2)}s` +
      (pcmSeconds !== null ? ` (decoded ${pcmSeconds.toFixed(2)}s, no phantom audio)` : ""),
  ];
  if (video) parts.push(`video ${video.duration.toFixed(2)}s @ ${video.rFps} CFR`);
  console.error(`sync check: PASS — ${parts.join(", ")}`);
}
