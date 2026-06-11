/**
 * fetch-data.mjs — builds data/today.json for the render.
 *
 * Fixture sources, tried in order:
 *   1. football-data.org  (FOOTBALL_DATA_TOKEN) — free tier INCLUDES the World Cup
 *   2. API-Football       (API_FOOTBALL_KEY)    — requires a PAID plan for current seasons
 *
 * If neither returns a fixture for today, the video switches to THROWBACK mode:
 * Claude picks a specific, dated classic World Cup match and the template
 * renders a clearly-labelled archive design — today's date is never faked.
 */

import { writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";

const { FOOTBALL_DATA_TOKEN, API_FOOTBALL_KEY, ANTHROPIC_API_KEY } = process.env;
const OUT = new URL("../data/today.json", import.meta.url);

const TEAM_COLORS = {
  Brazil: "#FFDF00", Germany: "#DD0000", Argentina: "#75AADB", France: "#0055A4",
  England: "#CE1124", Spain: "#C60B1E", Portugal: "#006600", Netherlands: "#FF6600",
  Nigeria: "#008751", Senegal: "#00853F", Morocco: "#C1272D", Ghana: "#FCD116",
  USA: "#3C3B6E", "United States": "#3C3B6E", Mexico: "#006847", Canada: "#FF0000",
  Japan: "#BC002D", Italy: "#008C45", Uruguay: "#7B9FD4", Croatia: "#FF0000",
  Belgium: "#FDDA24", "South Korea": "#CD2E3A", Australia: "#FFCD00",
};

// REST Countries lookup aliases for football names
const COUNTRY_ALIASES = {
  USA: "United States", "Korea Republic": "South Korea", "South Korea": "Korea (Republic of)",
  "IR Iran": "Iran", England: "United Kingdom", Scotland: "United Kingdom", Wales: "United Kingdom",
};

const todayISO = () => new Date().toISOString().slice(0, 10);

async function fromFootballData() {
  if (!FOOTBALL_DATA_TOKEN) return null;
  const d = todayISO();
  const res = await fetch(
    `https://api.football-data.org/v4/competitions/WC/matches?dateFrom=${d}&dateTo=${d}`,
    { headers: { "X-Auth-Token": FOOTBALL_DATA_TOKEN } }
  );
  if (!res.ok) { console.warn(`football-data.org: HTTP ${res.status}`); return null; }
  const json = await res.json();
  const m = json.matches?.find((x) => x.homeTeam?.name && x.awayTeam?.name);
  if (!m) return null;
  return {
    teamA: m.homeTeam.name,
    teamB: m.awayTeam.name,
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
  if (json.errors && Object.keys(json.errors).length) {
    console.warn("api-football errors:", JSON.stringify(json.errors));
  }
  const fx = json.response?.[0];
  if (!fx) return null;
  return {
    teamA: fx.teams.home.name,
    teamB: fx.teams.away.name,
    kickoff: new Date(fx.fixture.date).toUTCString().slice(17, 22) + " GMT",
    venue: `${fx.fixture.venue?.name ?? ""}${fx.fixture.venue?.city ? ", " + fx.fixture.venue.city : ""}` || "2026 FIFA World Cup",
  };
}


async function fromTheSportsDB() {
  // Free community API, no key needed — used as a third opinion
  const d = todayISO();
  const res = await fetch(
    `https://www.thesportsdb.com/api/v1/json/3/eventsday.php?d=${d}&l=FIFA%20World%20Cup`
  );
  if (!res.ok) { console.warn(`thesportsdb: HTTP ${res.status}`); return null; }
  const json = await res.json();
  const e = json.events?.find((x) => x.strHomeTeam && x.strAwayTeam);
  if (!e) return null;
  return {
    teamA: e.strHomeTeam,
    teamB: e.strAwayTeam,
    kickoff: e.strTime ? e.strTime.slice(0, 5) + " GMT" : "Today",
    venue: e.strVenue ?? "2026 FIFA World Cup",
  };
}

// Cross-validate sources: same two teams (order-insensitive) = agreement
const pairKey = (f) => [f.teamA, f.teamB].map((s) => s.toLowerCase().trim()).sort().join("|");

async function getCountry(name) {
  const lookup = COUNTRY_ALIASES[name] ?? name;
  try {
    const res = await fetch(
      `https://restcountries.com/v3.1/name/${encodeURIComponent(lookup)}?fields=cca2,capital,population`
    );
    const [c] = await res.json();
    const pop = c.population >= 1e9 ? `${(c.population / 1e9).toFixed(1)}B`
              : c.population >= 1e6 ? `${Math.round(c.population / 1e6)}M`
              : `${Math.round(c.population / 1e3)}K`;
    return {
      name, code: c.cca2.toLowerCase(),
      capital: c.capital?.[0] ?? "—", population: pop,
      color: TEAM_COLORS[name] ?? "#E8B83A", worldCupTitles: 0,
    };
  } catch {
    return { name, code: "un", capital: "—", population: "—", color: TEAM_COLORS[name] ?? "#E8B83A", worldCupTitles: 0 };
  }
}

async function askClaude(prompt) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-5",
      max_tokens: 800,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  const json = await res.json();
  const text = json.content?.map((b) => b.text ?? "").join("") ?? "";
  return JSON.parse(text.replace(/```json|```/g, "").trim());
}

const matchPrompt = (a, b) => `Today's 2026 World Cup match: ${a} vs ${b}.
Write content for a 28-second TikTok fact video. Only include facts you are CERTAIN are true; prefer well-documented historical facts over recent ones. Be strictly NEUTRAL: no favoritism toward either team, no predictions stated as facts, no stereotypes about countries, cultures, or fans. Use only objective, sourced-style facts (records, dates, numbers). Respond with ONLY a JSON object, no markdown fences:
{
  "hook": "one-line hook, max 10 words",
  "facts": ["3 short, surprising, verifiably TRUE facts about these two countries' World Cup history or football culture, each max 20 words"],
  "question": "a fun prediction question, max 6 words",
  "titlesA": <number of World Cup titles ${a} has won>,
  "titlesB": <number of World Cup titles ${b} has won>
}`;

const throwbackPrompt = () => `Pick ONE iconic, well-documented World Cup match from history (any year 1930-2022). It must be a real match you are CERTAIN about. Be strictly NEUTRAL and objective: documented records, dates, scorers, attendance figures — no stereotypes or editorializing. Respond with ONLY a JSON object, no markdown fences:
{
  "teamA": "country name",
  "teamB": "country name",
  "year": <year>,
  "scoreline": "e.g. 2-1 (a.e.t.)",
  "stage": "e.g. Final, Semi-final",
  "venue": "stadium, city",
  "hook": "one-line hook, max 10 words",
  "facts": ["3 short, specific, verifiably TRUE facts about that match, each max 20 words, include names/numbers"],
  "question": "engagement question about the match, max 8 words",
  "titlesA": <World Cup titles teamA has won>,
  "titlesB": <World Cup titles teamB has won>
}`;


const verifyPrompt = (facts, context) => `Fact-check these statements about ${context}. For each, answer whether you are HIGHLY confident it is true and free of bias or editorializing. Respond ONLY with JSON, no fences: {"verified": [list containing only the statements that pass, unchanged]}
Statements: ${JSON.stringify(facts)}`;

async function verifiedFacts(facts, context, teamA, teamB) {
  let kept = facts;
  try {
    const v = await askClaude(verifyPrompt(facts, context));
    if (Array.isArray(v.verified)) kept = v.verified.filter((f) => typeof f === "string");
  } catch (e) { console.warn("verification pass failed, keeping originals:", e.message); }
  // Top up with data-derived facts (from REST Countries — inherently sourced)
  const backups = [
    `${teamA.name} has won the World Cup ${teamA.worldCupTitles} time${teamA.worldCupTitles === 1 ? "" : "s"}; ${teamB.name} ${teamB.worldCupTitles}.`,
    `${teamA.name} has a population of ${teamA.population}; ${teamB.name} has ${teamB.population}.`,
    `Capitals: ${teamA.capital} (${teamA.name}) and ${teamB.capital} (${teamB.name}).`,
  ];
  while (kept.length < 3 && backups.length) kept.push(backups.shift());
  if (kept.length < facts.length) console.log(`ℹ️ verification dropped ${facts.length - kept.length} fact(s), topped up with data-derived facts`);
  return kept.slice(0, 3);
}

async function main() {
  if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is required");

  const music = existsSync(new URL("../public/music.mp3", import.meta.url));
  const dateStr = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

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
      console.warn("⚠️ Sources DISAGREE on today's fixture — using football-data.org (official data partner) and flagging:");
      sources.forEach((s) => console.warn(`   ${s.name}: ${s.teamA} vs ${s.teamB}`));
      fixture = sources.find((s) => s.name === "football-data.org") ?? sources[0];
    }
  } else if (sources.length === 1) {
    fixture = sources[0];
    console.log(`ℹ️ Only one source available (${fixture.name}) — proceeding with it`);
  }

  let data;
  if (fixture) {
    const [teamA, teamB] = await Promise.all([getCountry(fixture.teamA), getCountry(fixture.teamB)]);
    const copy = await askClaude(matchPrompt(teamA.name, teamB.name));
    teamA.worldCupTitles = copy.titlesA ?? 0;
    teamB.worldCupTitles = copy.titlesB ?? 0;
    const checked = await verifiedFacts(copy.facts.slice(0, 3), `the ${teamA.name} vs ${teamB.name} World Cup matchup`, teamA, teamB);
    data = {
      mode: "match", date: dateStr, kickoff: fixture.kickoff, venue: fixture.venue,
      teamA, teamB, hook: copy.hook, facts: checked, question: copy.question, music,
    };
    console.log(`✅ MATCH mode: ${teamA.name} vs ${teamB.name}`);
  } else {
    console.log("ℹ️  No fixture found from any source — switching to THROWBACK mode");
    const tb = await askClaude(throwbackPrompt());
    const [teamA, teamB] = await Promise.all([getCountry(tb.teamA), getCountry(tb.teamB)]);
    teamA.worldCupTitles = tb.titlesA ?? 0;
    teamB.worldCupTitles = tb.titlesB ?? 0;
    const checkedTb = await verifiedFacts(tb.facts.slice(0, 3), `the ${tb.year} ${tb.stage} between ${teamA.name} and ${teamB.name}`, teamA, teamB);
    data = {
      mode: "throwback", date: dateStr, year: tb.year, scoreline: tb.scoreline,
      stage: tb.stage, kickoff: `${tb.stage} · Final score ${tb.scoreline}`, venue: tb.venue,
      teamA, teamB, hook: tb.hook, facts: checkedTb, question: tb.question, music,
    };
    console.log(`✅ THROWBACK mode: ${teamA.name} vs ${teamB.name}, ${tb.year}`);
  }

  await writeFile(OUT, JSON.stringify(data, null, 2));
}

main().catch((e) => {
  // Hard fail: better no video than a wrong one.
  console.error(`❌ ${e.message}`);
  process.exit(1);
});
