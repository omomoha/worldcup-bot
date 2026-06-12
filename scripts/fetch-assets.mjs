/**
 * fetch-assets.mjs — downloads one vertical stock clip per match from Pexels
 * to use as a live background layer. Runs after fetch-data, before validate.
 *
 * Setup: free API key from https://www.pexels.com/api/ -> repo secret PEXELS_API_KEY
 * Licensing: Pexels License permits free commercial use, no attribution required.
 * Without the key (or on any failure) videos render with the gradient
 * backgrounds exactly as before — this layer is purely additive.
 */
import { readFile, writeFile } from "node:fs/promises";
import { createWriteStream } from "node:fs";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

const KEY = process.env.PEXELS_API_KEY;
const MATCHES = new URL("../data/matches.json", import.meta.url);

const QUERIES = [
  "soccer stadium crowd",
  "football fans cheering",
  "soccer ball grass field",
  "stadium floodlights night",
  "football training pitch",
];

function hashStr(s) { let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; }

async function findClip(query) {
  const res = await fetch(
    `https://api.pexels.com/videos/search?query=${encodeURIComponent(query)}&orientation=portrait&size=medium&per_page=15`,
    { headers: { Authorization: KEY } }
  );
  if (!res.ok) throw new Error(`Pexels HTTP ${res.status}`);
  const json = await res.json();
  const vids = (json.videos ?? []).filter((v) => v.duration >= 8);
  if (!vids.length) return null;
  const v = vids[hashStr(query + new Date().toISOString().slice(0, 10)) % vids.length];
  // smallest portrait file that's at least 720 wide keeps downloads light
  const file = v.video_files
    .filter((f) => f.width && f.height > f.width && f.width >= 720)
    .sort((a, b) => a.width - b.width)[0] ?? v.video_files[0];
  return file?.link ?? null;
}

async function main() {
  const matches = JSON.parse(await readFile(MATCHES, "utf8"));
  if (!KEY) {
    console.log("ℹ️  PEXELS_API_KEY not set — rendering with gradient backgrounds.");
    return;
  }
  for (let i = 0; i < matches.length; i++) {
    try {
      const query = QUERIES[(hashStr(matches[i].teamA.name + matches[i].date) + i) % QUERIES.length];
      const link = await findClip(query);
      if (!link) { console.warn(`no clip found for "${query}"`); continue; }
      const res = await fetch(link);
      if (!res.ok) throw new Error(`download HTTP ${res.status}`);
      await pipeline(Readable.fromWeb(res.body), createWriteStream(new URL(`../public/bg${i}.mp4`, import.meta.url)));
      matches[i].bgVideo = `bg${i}.mp4`;
      console.log(`✅ background ${i}: "${query}" clip downloaded`);
    } catch (e) {
      console.warn(`⚠️ background ${i} failed (${e.message}) — gradient fallback`);
    }
  }
  await writeFile(MATCHES, JSON.stringify(matches, null, 2));
}

main().catch((e) => { console.warn("⚠️ asset step failed entirely, continuing without:", e.message); });
