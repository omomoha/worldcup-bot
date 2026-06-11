/**
 * deliver.mjs
 * Sends the rendered video straight to your phone via a Telegram bot.
 *
 * One-time setup (5 minutes):
 *   1. In Telegram, message @BotFather → /newbot → copy the bot token
 *   2. Open a chat with your new bot and send it any message
 *   3. Visit https://api.telegram.org/bot<TOKEN>/getUpdates in a browser
 *      and copy your "chat":{"id": ...} number
 *   4. Save both as GitHub secrets: TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID
 *
 * Every morning the bot messages you the finished video + suggested caption.
 * Save the video from Telegram → post to TikTok from the app. Done.
 */

import { readFile } from "node:fs/promises";

const { TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID } = process.env;
const videoPath = process.argv[2] ?? "out/today.mp4";

async function main() {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    console.log("ℹ️  Telegram secrets not set — skipping delivery.");
    return;
  }

  const data = await readFile(new URL("../data/today.json", import.meta.url), "utf8")
    .then(JSON.parse)
    .catch(() => null);

  const caption = data
    ? `🏆 ${data.teamA.name} vs ${data.teamB.name} — ${data.date}\n\n${data.hook}\n\nSuggested caption:\n${data.teamA.name} vs ${data.teamB.name} 🔥 ${data.question} #WorldCup2026 #football #facts`
    : "🏆 Today's World Cup video";

  const video = await readFile(videoPath);
  const form = new FormData();
  form.append("chat_id", TELEGRAM_CHAT_ID);
  form.append("caption", caption.slice(0, 1024));
  form.append("video", new Blob([video], { type: "video/mp4" }), "today.mp4");

  const res = await fetch(
    `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendVideo`,
    { method: "POST", body: form }
  );
  const json = await res.json();
  if (!json.ok) throw new Error(`Telegram send failed: ${JSON.stringify(json)}`);
  console.log("✅ Video delivered to your Telegram");
}

main().catch((e) => {
  console.error("❌", e.message);
  process.exit(1);
});
