/** Sends every rendered video to your phone via Telegram, each with its
 * ready-to-paste TikTok caption. Setup: see README (BotFather token + chat id). */
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";

const { TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID } = process.env;

async function sendVideo(path, caption) {
  const video = await readFile(path);
  const form = new FormData();
  form.append("chat_id", TELEGRAM_CHAT_ID);
  form.append("caption", caption.slice(0, 1024));
  form.append("video", new Blob([video], { type: "video/mp4" }), path.split("/").pop());
  const res = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendVideo`, { method: "POST", body: form });
  const json = await res.json();
  if (!json.ok) throw new Error(`Telegram send failed: ${JSON.stringify(json)}`);
}

async function main() {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    console.log("ℹ️  Telegram secrets not set — skipping delivery.");
    return;
  }
  const matches = JSON.parse(await readFile(new URL("../data/matches.json", import.meta.url), "utf8"));
  for (let i = 0; i < matches.length; i++) {
    const path = `out/match${i}.mp4`;
    if (!existsSync(path)) { console.warn(`⚠️ ${path} missing, skipping`); continue; }
    const m = matches[i];
    const caption = m.caption ?? `${m.teamA.name} vs ${m.teamB.name} #WorldCup2026`;
    await sendVideo(path, caption);
    console.log(`✅ delivered ${i + 1}/${matches.length}: ${m.teamA.name} vs ${m.teamB.name}`);
  }
}

main().catch((e) => { console.error("❌", e.message); process.exit(1); });
