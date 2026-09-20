import { execFile } from "node:child_process";
import { promisify } from "node:util";

const pexec = promisify(execFile);
const MAX_BUFFER = 1024 * 1024 * 256;

/**
 * Run ffmpeg with an argv array (no shell — paths with spaces/brackets are
 * safe). Throws on non-zero exit, surfacing the tail of stderr. Analysis
 * passes (`-f null -`) exit 0, so blackdetect callers get stderr back here.
 */
export async function runFfmpeg(args: string[]): Promise<{ stdout: string; stderr: string }> {
  try {
    const { stdout, stderr } = await pexec("ffmpeg", args, { maxBuffer: MAX_BUFFER });
    return { stdout: String(stdout), stderr: String(stderr) };
  } catch (e) {
    const err = e as { stderr?: string };
    const tail = String(err.stderr ?? "").split("\n").slice(-12).join("\n");
    throw new Error(`ffmpeg failed:\n${tail}`);
  }
}

export async function runFfprobe(args: string[]): Promise<string> {
  const { stdout } = await pexec("ffprobe", args, { maxBuffer: MAX_BUFFER });
  return String(stdout);
}

/** Verify required binaries are installed; throw an actionable error if not. */
export async function assertBinaries(names: string[] = ["ffmpeg", "ffprobe"]): Promise<void> {
  for (const bin of names) {
    try {
      await pexec(bin, ["--version"], { maxBuffer: MAX_BUFFER });
    } catch {
      try {
        await pexec(bin, ["-version"], { maxBuffer: MAX_BUFFER });
      } catch {
        throw new Error(`'${bin}' not found on PATH. Install it (e.g. 'brew install ${bin === "pnpm" ? "pnpm" : "ffmpeg"}').`);
      }
    }
  }
}
