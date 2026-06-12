/**
 * validate.mjs — quality gate between data fetch and render.
 * The run FAILS (no video is sent) if any check fails:
 *   - every team resolved to a real flag code (never "un"/generic)
 *   - every flag image actually exists on flagcdn (HTTP check)
 *   - 3 non-empty facts, 2+ stat lines per team, hook/question/caption present
 *   - no placeholder values ("—", "undefined", empty strings)
 */
import { readFile } from "node:fs/promises";

const matches = JSON.parse(await readFile(new URL("../data/matches.json", import.meta.url), "utf8"));
const errors = [];

const bad = (s) => !s || typeof s !== "string" || !s.trim() || s.includes("undefined") || s.trim() === "—";

for (let i = 0; i < matches.length; i++) {
  const m = matches[i];
  const tag = `match${i} (${m.teamA?.name} vs ${m.teamB?.name})`;

  for (const side of ["teamA", "teamB"]) {
    const t = m[side];
    if (!t) { errors.push(`${tag}: missing ${side}`); continue; }
    if (!t.code || t.code === "un") errors.push(`${tag}: ${t.name} has no real flag code`);
    if (!Array.isArray(t.stats) || t.stats.filter((s) => !bad(s)).length < 2)
      errors.push(`${tag}: ${t.name} has fewer than 2 valid stat lines`);
    // verify the flag image really exists
    try {
      let res = await fetch(`https://flagcdn.com/w640/${t.code}.png`, { method: "HEAD" });
      if (!res.ok) res = await fetch(`https://flagcdn.com/w640/${t.code}.png`); // some CDNs reject HEAD
      if (!res.ok) errors.push(`${tag}: flag image for ${t.name} (${t.code}) returned HTTP ${res.status}`);
    } catch (e) {
      errors.push(`${tag}: flag check for ${t.name} failed: ${e.message}`);
    }
  }

  if (!Array.isArray(m.facts) || m.facts.length !== 3 || m.facts.some(bad))
    errors.push(`${tag}: needs exactly 3 non-empty facts`);
  // Layout budgets — text longer than these breaks the design
  const LIMITS = { stat: 44, hook: 58, fact: 132, question: 46 };
  for (const side of ["teamA", "teamB"])
    for (const s of m[side]?.stats ?? [])
      if (s.length > LIMITS.stat) errors.push(`${tag}: stat too long (${s.length} chars): "${s}"`);
  if (m.hook?.length > LIMITS.hook) errors.push(`${tag}: hook too long (${m.hook.length} chars)`);
  if (m.question?.length > LIMITS.question) errors.push(`${tag}: question too long (${m.question.length} chars)`);
  (m.facts ?? []).forEach((f, fi) => { if (f.length > LIMITS.fact) errors.push(`${tag}: fact ${fi + 1} too long (${f.length} chars)`); });
  if (bad(m.hook)) errors.push(`${tag}: missing hook`);
  if (bad(m.question)) errors.push(`${tag}: missing question`);
  if (bad(m.caption)) errors.push(`${tag}: missing caption`);
  if (m.tweet) {
    if (m.tweet.length > 280) errors.push(`${tag}: tweet too long (${m.tweet.length} chars)`);
    for (const phrase of ["My call", "Your score?", "Who's taking it"])
      if (m.tweet.includes(phrase)) errors.push(`${tag}: tweet contains template phrase "${phrase}"`);
  }
  if (bad(m.venue)) errors.push(`${tag}: missing venue`);
  if (m.mode === "match" && bad(m.kickoff)) errors.push(`${tag}: missing kickoff`);
}

if (errors.length) {
  console.error(`❌ Validation failed — refusing to render/send:`);
  errors.forEach((e) => console.error("  -", e));
  process.exit(1);
}
console.log(`✅ Validation passed for ${matches.length} match(es): flags verified, content complete`);
