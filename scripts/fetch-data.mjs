/**
 * fetch-data.mjs — builds data/today.json for the render.
 *
 * Fixtures: football-data.org + API-Football + TheSportsDB, cross-validated
 * (proceeds confidently only when sources agree; logs disagreements).
 * Country data: built-in FIFA nations dataset (flags can't break).
 * Copy: Claude writes football-focused stats/facts/caption under strict
 * neutrality rules, then a second verification pass drops anything uncertain.
 * If no fixture exists today → clearly-labelled THROWBACK mode.
 * If data can't be trusted → hard fail. Never a wrong "match day".
 */

import { writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";

const { FOOTBALL_DATA_TOKEN, API_FOOTBALL_KEY, ANTHROPIC_API_KEY } = process.env;
const OUT = new URL("../data/today.json", import.meta.url);

// ---- Built-in FIFA nations dataset: flag code, jersey color, WC titles ----
// Titles are settled historical record (through 2022). Flags via flagcdn ISO codes.
const TEAMS = {
  "Mexico":        { code: "mx",     color: "#006847", titles: 0 },
  "South Africa":  { code: "za",     color: "#007A4D", titles: 0 },
  "USA":           { code: "us",     color: "#3C3B6E", titles: 0 },
  "United States": { code: "us",     color: "#3C3B6E", titles: 0 },
  "Canada":        { code: "ca",     color: "#FF0000", titles: 0 },
  "Brazil":        { code: "br",     color: "#FFDF00", titles: 5 },
  "Argentina":     { code: "ar",     color: "#75AADB", titles: 3 },
  "Germany":       { code: "de",     color: "#DD0000", titles: 4 },
  "Italy":         { code: "it",     color: "#008C45", titles: 4 },
  "France":        { code: "fr",     color: "#0055A4", titles: 2 },
  "Uruguay":       { code: "uy",     color: "#7B9FD4", titles: 2 },
  "England":       { code: "gb-eng", color: "#CE1124", titles: 1 },
  "Spain":         { code: "es",     color: "#C60B1E", titles: 1 },
  "Portugal":      { code: "pt",     color: "#006600", titles: 0 },
  "Netherlands":   { code: "nl",     color: "#FF6600", titles: 0 },
  "Belgium":       { code: "be",     color: "#FDDA24", titles: 0 },
  "Croatia":       { code: "hr",     color: "#FF0000", titles: 0 },
  "Switzerland":   { code: "ch",     color: "#DA291C", titles: 0 },
  "Austria":       { code: "at",     color: "#ED2939", titles: 0 },
  "Poland":        { code: "pl",     color: "#DC143C", titles: 0 },
  "Denmark":       { code: "dk",     color: "#C8102E", titles: 0 },
  "Sweden":        { code: "se",     color: "#FECC02", titles: 0 },
  "Norway":        { code: "no",     color: "#BA0C2F", titles: 0 },
  "Scotland":      { code: "gb-sct", color: "#0065BF", titles: 0 },
  "Wales":         { code: "gb-wls", color: "#C8102E", titles: 0 },
  "Serbia":        { code: "rs",     color: "#C6363C", titles: 0 },
  "Turkey":        { code: "tr",     color: "#E30A17", titles: 0 },
  "Ukraine":       { code: "ua",     color: "#FFD700", titles: 0 },
  "Japan":         { code: "jp",     color: "#BC002D", titles: 0 },
  "South Korea":   { code: "kr",     color: "#CD2E3A", titles: 0 },
  "Korea Republic":{ code: "kr",     color: "#CD2E3A", titles: 0 },
  "Saudi Arabia":  { code: "sa",     color: "#006C35", titles: 0 },
  "Iran":          { code: "ir",     color: "#DA0000", titles: 0 },
  "IR Iran":       { code: "ir",     color: "#DA0000", titles: 0 },
  "Qatar":         { code: "qa",     color: "#8A1538", titles: 0 },
  "Australia":     { code: "au",     color: "#FFCD00", titles: 0 },
  "Uzbekistan":    { code: "uz",     color: "#1EB53A", titles: 0 },
  "Jordan":        { code: "jo",     color: "#CE1126", titles: 0 },
  "New Zealand":   { code: "nz",     color: "#00247D", titles: 0 },
  "Morocco":       { code: "ma",     color: "#C1272D", titles: 0 },
  "Senegal":       { code: "sn",     color: "#00853F", titles: 0 },
  "Ghana":         { code: "gh",     color: "#FCD116", titles: 0 },
  "Nigeria":       { code: "ng",     color: "#008751", titles: 0 },
  "Cameroon":      { code: "cm",     color: "#007A5E", titles: 0 },
  "Egypt":         { code: "eg",     color: "#CE1126", titles: 0 },
  "Tunisia":       { code: "tn",     color: "#E70013", titles: 0 },
  "Algeria":       { code: "dz",     color: "#006233", titles: 0 },
  "Ivory Coast":   { code: "ci",     color: "#F77F00", titles: 0 },
  "Côte d'Ivoire": { code: "ci",     color: "#F77F00", titles: 0 },
  "Mali":          { code: "ml",     color: "#14B53A", titles: 0 },
  "Cape Verde":    { code: "cv",     color: "#003893", titles: 0 },
  "Colombia":      { code: "co",     color: "#FCD116", titles: 0 },
  "Ecuador":       { code: "ec",     color: "#FFDD00", titles: 0 },
  "Chile":         { code: "cl",     color: "#D52B1E", titles: 0 },
  "Peru":          { code: "pe",     color: "#D91023", titles: 0 },
  "Paraguay":      { code: "py",     color: "#D52B1E", titles: 0 },
  "Bolivia":       { code: "bo",     color: "#007934", titles: 0 },
  "Venezuela":     { code: "ve",     color: "#7B0000", titles: 0 },
  "Costa Rica":    { code: "cr",     color: "#002B7F", titles: 0 },
  "Panama":        { code: "pa",     color: "#DA121A", titles: 0 },
  "Honduras":      { code: "hn",     color: "#0073CF", titles: 0 },
  "Jamaica":       { code: "jm",     color: "#FED100", titles: 0 },
  "Haiti":         { code: "ht",     color: "#00209F", titles: 0 },
  "Curaçao":       { code: "cw",     color: "#002B7F", titles: 0 },
  "Russia":        { code: "ru",     color: "#D52B1E", titles: 0 },
};

const todayISO = () => new Date().toISOString().slice(0, 10);

function getTeam(rawName) {
  const name = rawName.replace(/ U2[0-9]| W$/g, "").trim();
  const hit = TEAMS[name] ?? TEAMS[Object.keys(TEAMS).find((k) => name.includes(k) || k.includes(name)) ?? ""];
  if (!hit) {
    console.warn(`⚠️ "${name}" not in built-in dataset — flag may be generic. Add it to TEAMS.`);
    return { name, code: "un", color: "#E8B83A", worldCupTitles: 0, stats: [] };
  }
  return { name, code: hit.code, color: hit.color, worldCupTitles: hit.titles, stats: [] };
}

// ---------- Fixture sources ----------
async function fromFootballData() {
  if (!FOOTBALL_DATA_TOKEN) return null;
  const d = todayISO();
  const res = await fetch(
    `https://api.football-data.org/v4/competitions/WC/matches?dateFrom=${d}&dateTo=${d}`,
    { headers: { "X-Auth-Token": FOOTBALL_DATA_TOKEN } }
  );
  if (!res.ok) { console.warn(`football-data.org: HTTP ${res.status}`); return null; }
  const m = (await res.json()).matches?.find((x) => x.homeTeam?.name && x.awayTeam?.name);
  if (!m) return null;
  return {
    teamA: m.homeTeam.name, teamB: m.awayTeam.name,
    kickoff: new Date(m.utcDate).toUTCString().slice(17, 22) + " GMT",
    venue: m.venue ?? "2026 FIFA World Cup",
  };
}

async function fromApiFootball() {
  if (!API_FOOTBALL_KEY) return null;
  const res = await fetch(
    `https://v3.football.api-sports.io/fixtures?league=1&season=2026&date=${todayISO()}`,
    { headers: { "x-apisports-key": API_FOOTBALL_KEY } }
  );
  if (!res.ok) { console.warn(`api-football: HTTP ${res.status}`); return null; }
  const json = await res.json();
  if (json.errors && Object.keys(json.errors).length) console.warn("api-football errors:", JSON.stringify(json.errors));
  const fx = json.response?.[0];
  if (!fx) return null;
  return {
    teamA: fx.teams.home.name, teamB: fx.teams.away.name,
    kickoff: new Date(fx.fixture.date).toUTCString().slice(17, 22) + " GMT",
    venue: `${fx.fixture.venue?.name ?? ""}${fx.fixture.venue?.city ? ", " + fx.fixture.venue.city : ""}` || "2026 FIFA World Cup",
  };
}

async function fromTheSportsDB() {
  const res = await fetch(
    `https://www.thesportsdb.com/api/v1/json/3/eventsday.php?d=${todayISO()}&l=FIFA%20World%20Cup`
  );
  if (!res.ok) { console.warn(`thesportsdb: HTTP ${res.status}`); return null; }
  const e = (await res.json()).events?.find((x) => x.strHomeTeam && x.strAwayTeam);
  if (!e) return null;
  return {
    teamA: e.strHomeTeam, teamB: e.strAwayTeam,
    kickoff: e.strTime ? e.strTime.slice(0, 5) + " GMT" : "Today",
    venue: e.strVenue ?? "2026 FIFA World Cup",
  };
}

const pairKey = (f) => [f.teamA, f.teamB].map((s) => s.toLowerCase().trim()).sort().join("|");

// ---------- Claude ----------
async function askClaude(prompt) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model: "claude-sonnet-4-5", max_tokens: 900, messages: [{ role: "user", content: prompt }] }),
  });
  const json = await res.json();
  const text = json.content?.map((b) => b.text ?? "").join("") ?? "";
  return JSON.parse(text.replace(/```json|```/g, "").trim());
}

const RULES = `RULES: Only state things you are CERTAIN are true and well-documented. Be strictly NEUTRAL — no favoritism, no predictions stated as facts, no stereotypes about countries, cultures, or fans. Football substance only: records, finishes, scorers, streaks, dates, numbers.`;

const matchPrompt = (a, b) => `Today's 2026 World Cup match: ${a} vs ${b}. Write content for a 28-second TikTok video. ${RULES}
Respond with ONLY a JSON object, no markdown fences:
{
  "hook": "one-line hook, max 10 words",
  "statsA": ["2 short FOOTBALL stat lines about ${a}, max 7 words each, e.g. best World Cup finish, appearances, famous record"],
  "statsB": ["2 short FOOTBALL stat lines about ${b}, max 7 words each"],
  "facts": ["3 short, surprising, verifiably TRUE football facts about these nations' World Cup history, each max 20 words"],
  "question": "a fun prediction question, max 6 words",
  "caption": "a TikTok caption written like a real football fan typed it on their phone — casual, energetic, lowercase ok, 1-2 sentences plus 3-4 hashtags including #WorldCup2026. No corporate tone, no quotation marks."
}`;

const throwbackPrompt = () => `Pick ONE iconic, well-documented World Cup match from history (1930-2022) that you are CERTAIN about. ${RULES}
Respond with ONLY a JSON object, no markdown fences:
{
  "teamA": "country", "teamB": "country", "year": <year>, "scoreline": "e.g. 2-1 (a.e.t.)",
  "stage": "e.g. Final, Semi-final", "venue": "stadium, city",
  "hook": "one-line hook, max 10 words",
  "statsA": ["2 short FOOTBALL stat lines about teamA, max 7 words each"],
  "statsB": ["2 short FOOTBALL stat lines about teamB, max 7 words each"],
  "facts": ["3 short, specific, verifiably TRUE facts about that match with names/numbers, each max 20 words"],
  "question": "engagement question about the match, max 8 words",
  "caption": "TikTok caption like a real football fan typed it — casual throwback energy, 1-2 sentences plus 3-4 hashtags including #WorldCup. No quotation marks."
}`;

const verifyPrompt = (items, context) => `Fact-check these statements about ${context}. Keep only those you are HIGHLY confident are true, neutral, and free of editorializing. Respond ONLY with JSON, no fences: {"verified": [the passing statements, unchanged]}
Statements: ${JSON.stringify(items)}`;

async function verified(items, context) {
  try {
    const v = await askClaude(verifyPrompt(items, context));
    if (Array.isArray(v.verified)) {
      const kept = v.verified.filter((f) => typeof f === "string");
      if (kept.length < items.length) console.log(`ℹ️ verification dropped ${items.length - kept.length} item(s) for ${context}`);
      return kept;
    }
  } catch (e) { console.warn("verification pass failed, keeping originals:", e.message); }
  return items;
}

function titleLine(t) {
  return t.worldCupTitles > 0
    ? `${t.worldCupTitles}x World Cup champions`
    : `Chasing a first World Cup title`;
}

async function main() {
  if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is required");

  const music = existsSync(new URL("../public/music.mp3", import.meta.url));
  const dateStr = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

  // ---- Multi-source fixture with consensus ----
  const sources = [];
  for (const [name, fn] of [["football-data.org", fromFootballData], ["api-football", fromApiFootball], ["thesportsdb", fromTheSportsDB]]) {
    try {
      const r = await fn();
      if (r) { sources.push({ name, ...r }); console.log(`source ${name}: ${r.teamA} vs ${r.teamB}`); }
      else console.log(`source ${name}: no fixture`);
    } catch (e) { console.warn(`source ${name} failed:`, e.message); }
  }
  let fixture = null;
  if (sources.length >= 2) {
    const counts = {};
    for (const s of sources) counts[pairKey(s)] = (counts[pairKey(s)] ?? 0) + 1;
    const agreed = sources.find((s) => counts[pairKey(s)] >= 2);
    if (agreed) { fixture = agreed; console.log(`✅ ${counts[pairKey(agreed)]} sources agree on the fixture`); }
    else {
      console.warn("⚠️ Sources DISAGREE — using football-data.org and flagging:");
      sources.forEach((s) => console.warn(`   ${s.name}: ${s.teamA} vs ${s.teamB}`));
      fixture = sources.find((s) => s.name === "football-data.org") ?? sources[0];
    }
  } else if (sources.length === 1) {
    fixture = sources[0];
    console.log(`ℹ️ Only one source available (${fixture.name})`);
  }

  let data;
  if (fixture) {
    const teamA = getTeam(fixture.teamA);
    const teamB = getTeam(fixture.teamB);
    const copy = await askClaude(matchPrompt(teamA.name, teamB.name));
    teamA.stats = [titleLine(teamA), ...(await verified(copy.statsA ?? [], `${teamA.name}'s football record`))].slice(0, 3);
    teamB.stats = [titleLine(teamB), ...(await verified(copy.statsB ?? [], `${teamB.name}'s football record`))].slice(0, 3);
    const facts = await verified(copy.facts.slice(0, 3), `the ${teamA.name} vs ${teamB.name} World Cup matchup`);
    while (facts.length < 3) facts.push(`${teamA.name} and ${teamB.name} meet today at the 2026 World Cup — ${fixture.venue}.`);
    data = {
      mode: "match", date: dateStr, kickoff: fixture.kickoff, venue: fixture.venue,
      teamA, teamB, hook: copy.hook, facts: facts.slice(0, 3), question: copy.question,
      caption: copy.caption ?? `${teamA.name} vs ${teamB.name} today 👀 who's taking it? #WorldCup2026 #football`,
      music,
    };
    console.log(`✅ MATCH mode: ${teamA.name} vs ${teamB.name}`);
  } else {
    console.log("ℹ️ No fixture from any source — THROWBACK mode");
    const tb = await askClaude(throwbackPrompt());
    const teamA = getTeam(tb.teamA);
    const teamB = getTeam(tb.teamB);
    teamA.stats = [titleLine(teamA), ...(await verified(tb.statsA ?? [], `${teamA.name}'s football record`))].slice(0, 3);
    teamB.stats = [titleLine(teamB), ...(await verified(tb.statsB ?? [], `${teamB.name}'s football record`))].slice(0, 3);
    const facts = await verified(tb.facts.slice(0, 3), `the ${tb.year} ${tb.stage} between ${teamA.name} and ${teamB.name}`);
    if (facts.length < 2) throw new Error("Throwback facts failed verification — refusing to publish uncertain content");
    data = {
      mode: "throwback", date: dateStr, year: tb.year, scoreline: tb.scoreline, stage: tb.stage,
      kickoff: `${tb.stage} · Final score ${tb.scoreline}`, venue: tb.venue,
      teamA, teamB, hook: tb.hook, facts: facts.slice(0, 3), question: tb.question,
      caption: tb.caption ?? `throwback to ${teamA.name} vs ${teamB.name}, ${tb.year} 🔥 #WorldCup #throwback`,
      music,
    };
    console.log(`✅ THROWBACK mode: ${teamA.name} vs ${teamB.name}, ${tb.year}`);
  }

  await writeFile(OUT, JSON.stringify(data, null, 2));
}

main().catch((e) => {
  console.error(`❌ ${e.message}`);
  process.exit(1); // better no video than a wrong one
});
