/**
 * post-tiktok.mjs
 * Uploads the rendered video via TikTok's Content Posting API (Direct Post).
 *
 * Prerequisites:
 *   1. Register an app at https://developers.tiktok.com
 *   2. Apply for the "Content Posting API" product + video.publish scope
 *      (approval is manual and can take 1–2 weeks)
 *   3. Complete the OAuth flow once to obtain a refresh token, store it
 *      as TIKTOK_REFRESH_TOKEN along with TIKTOK_CLIENT_KEY / _SECRET
 *
 * Note: unaudited apps can only post as PRIVATE (SELF_ONLY) videos.
 * Once your app passes TikTok's audit, switch privacy_level below.
 *
 * Simpler alternative while waiting for approval: upload the file to a
 * scheduler (Metricool, Postiz, Buffer) via their API instead.
 */

import { readFile, stat } from "node:fs/promises";
import { basename } from "node:path";

const {
  TIKTOK_CLIENT_KEY,
  TIKTOK_CLIENT_SECRET,
  TIKTOK_REFRESH_TOKEN,
} = process.env;

const videoPath = process.argv[2] ?? "out/today.mp4";

async function getAccessToken() {
  const res = await fetch("https://open.tiktokapis.com/v2/oauth/token/", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_key: TIKTOK_CLIENT_KEY,
      client_secret: TIKTOK_CLIENT_SECRET,
      grant_type: "refresh_token",
      refresh_token: TIKTOK_REFRESH_TOKEN,
    }),
  });
  const json = await res.json();
  if (!json.access_token) throw new Error(`Token refresh failed: ${JSON.stringify(json)}`);
  return json.access_token;
}

async function main() {
  if (!TIKTOK_CLIENT_KEY) {
    console.log(`ℹ️  TikTok credentials not set — skipping post. Video ready at: ${videoPath}`);
    return;
  }

  const token = await getAccessToken();
  const { size } = await stat(videoPath);
  const caption = (await readFile(new URL("../data/today.json", import.meta.url), "utf8")
    .then(JSON.parse)
    .then((d) => `${d.teamA.name} vs ${d.teamB.name} — ${d.hook} #WorldCup2026 #football #facts`)
    .catch(() => "Daily World Cup 2026 facts #WorldCup2026"));

  // 1. Initialize upload
  const init = await fetch("https://open.tiktokapis.com/v2/post/publish/video/init/", {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({
      post_info: {
        title: caption,
        privacy_level: "SELF_ONLY", // change to PUBLIC_TO_EVERYONE after app audit
        disable_comment: false,
      },
      source_info: {
        source: "FILE_UPLOAD",
        video_size: size,
        chunk_size: size, // single-chunk upload (videos < 64MB)
        total_chunk_count: 1,
      },
    }),
  }).then((r) => r.json());

  if (!init.data?.upload_url) throw new Error(`Init failed: ${JSON.stringify(init)}`);

  // 2. Upload the file
  const video = await readFile(videoPath);
  const up = await fetch(init.data.upload_url, {
    method: "PUT",
    headers: {
      "content-type": "video/mp4",
      "content-range": `bytes 0-${size - 1}/${size}`,
    },
    body: video,
  });
  if (!up.ok) throw new Error(`Upload failed: ${up.status}`);

  console.log(`✅ Posted ${basename(videoPath)} — publish_id: ${init.data.publish_id}`);
}

main().catch((e) => {
  console.error("❌", e.message);
  process.exit(1);
});
