import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

function readEnvKey(file: string): string | null {
  if (!existsSync(file)) return null;
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const m = line.match(/^\s*ELEVENLABS_API_KEY\s*=\s*(.+)\s*$/);
    if (m) return m[1]!.trim().replace(/^['"]|['"]$/g, "");
  }
  return null;
}

/**
 * Resolve the ElevenLabs Scribe key: explicit flag → env var → `.env` files
 * walking up from the input (file or directory — repo roots often hold the
 * key; a couple of common monorepo spots are checked at each level too) →
 * the skill's own `.env`.
 */
export function resolveApiKey(explicit: string | null, startPath: string, skillDir: string): string | null {
  if (explicit) return explicit;
  if (process.env.ELEVENLABS_API_KEY) return process.env.ELEVENLABS_API_KEY;

  let dir = resolve(startPath);
  try {
    if (!statSync(dir).isDirectory()) dir = dirname(dir);
  } catch {
    dir = dirname(dir);
  }
  const candidates: string[] = [];
  for (let i = 0; i < 8; i++) {
    candidates.push(
      join(dir, ".env"),
      join(dir, "app", "feynman-lib", ".env"),
      join(dir, "app", "studio", ".env"),
    );
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  candidates.push(join(skillDir, ".env"));
  for (const c of candidates) {
    const key = readEnvKey(c);
    if (key) return key;
  }
  return null;
}
