import { createHash } from "node:crypto";
import { createReadStream, existsSync } from "node:fs";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runFfmpeg } from "./ffmpeg.js";
import type { Word } from "./types.js";

const SCRIBE_URL = "https://api.elevenlabs.io/v1/speech-to-text";

export interface TranscribeOptions {
  apiKey: string;
  lang: string | null;
  cacheDir: string;
  retries?: number;
}

async function extractWav(input: string, dest: string): Promise<void> {
  await runFfmpeg(["-y", "-i", input, "-vn", "-ac", "1", "-ar", "16000", "-c:a", "pcm_s16le", dest]);
}

async function sourceHash(path: string, extra: string): Promise<string> {
  // Stream the hash — source videos can exceed Node's 2 GiB buffer cap.
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(path)) hash.update(chunk as Buffer);
  return hash.update(extra).digest("hex").slice(0, 32);
}

/**
 * Transcribe with ElevenLabs Scribe (word-level). Results are cached by source
 * hash, so re-runs never re-transcribe. Retries transient failures (the Scribe
 * upload occasionally drops the TLS connection mid-stream).
 */
export async function transcribe(input: string, opts: TranscribeOptions): Promise<Word[]> {
  await mkdir(opts.cacheDir, { recursive: true });
  const hash = await sourceHash(input, opts.lang ?? "auto");
  const cachePath = join(opts.cacheDir, `${hash}.json`);

  if (existsSync(cachePath)) {
    const cached = JSON.parse(await readFile(cachePath, "utf8")) as { words?: Word[] };
    return cached.words ?? [];
  }

  const wav = join(tmpdir(), `vp-mg-${hash}.wav`);
  try {
    await extractWav(input, wav);
    const audio = await readFile(wav);
    const retries = opts.retries ?? 3;
    let lastErr = "";

    for (let attempt = 1; attempt <= retries; attempt++) {
      const form = new FormData();
      form.set("model_id", "scribe_v1");
      form.set("timestamps_granularity", "word");
      form.set("tag_audio_events", "true");
      if (opts.lang) form.set("language_code", opts.lang);
      form.set("file", new Blob([audio], { type: "audio/wav" }), "audio.wav");

      try {
        const res = await fetch(SCRIBE_URL, {
          method: "POST",
          headers: { "xi-api-key": opts.apiKey },
          body: form,
        });
        if (res.ok) {
          const data = (await res.json()) as { words?: Word[] };
          await writeFile(cachePath, JSON.stringify(data));
          return data.words ?? [];
        }
        lastErr = `${res.status} ${(await res.text()).slice(0, 300)}`;
      } catch (e) {
        lastErr = String((e as Error).message ?? e);
      }
      if (attempt < retries) await new Promise((r) => setTimeout(r, 1000 * attempt));
    }
    throw new Error(`ElevenLabs Scribe failed after ${retries} attempts: ${lastErr}`);
  } finally {
    await rm(wav, { force: true });
  }
}
