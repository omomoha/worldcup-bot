/** Renders one video per match in data/matches.json -> out/match{i}.mp4 */
import { execSync } from "node:child_process";
import { readFile } from "node:fs/promises";

const matches = JSON.parse(await readFile(new URL("../data/matches.json", import.meta.url), "utf8"));
console.log(`Rendering ${matches.length} video(s)...`);
for (let i = 0; i < matches.length; i++) {
  const m = matches[i];
  console.log(`▶ Match${i}: ${m.teamA.name} vs ${m.teamB.name} [${m.skin}]`);
  execSync(`npx remotion render Match${i} out/match${i}.mp4`, { stdio: "inherit" });
}
console.log("✅ all renders complete");
