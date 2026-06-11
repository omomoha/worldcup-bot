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
Write content for a 28-second TikTok fact video. Only include facts you are CERTAIN are true; prefer well-documented historical facts over recent ones. Respond with ONLY a JSON object, no markdown fences:
{
  "hook": "one-line hook, max 10 words",
  "facts": ["3 short, surprising, verifiably TRUE facts about these two countries' World Cup history or football culture, each max 20 words"],
  "question": "a fun prediction question, max 6 words",
  "titlesA": <number of World Cup titles ${a} has won>,
  "titlesB": <number of World Cup titles ${b} has won>
}`;

const throwbackPrompt = () => `Pick ONE iconic, well-documented World Cup match from history (any year 1930-2022). It must be a real match you are CERTAIN about. Respond with ONLY a JSON object, no markdown fences:
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

async function main() {
  if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is required");

  const music = existsSync(new URL("../public/music.mp3", import.meta.url));
  const dateStr = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

  let fixture = null;
  try { fixture = await fromFootballData(); } catch (e) { console.warn("football-data.org failed:", e.message); }
  if (!fixture) { try { fixture = await fromApiFootball(); } catch (e) { console.warn("api-football failed:", e.message); } }

  let data;
  if (fixture) {
    const [teamA, teamB] = await Promise.all([getCountry(fixture.teamA), getCountry(fixture.teamB)]);
    const copy = await askClaude(matchPrompt(teamA.name, teamB.name));
    teamA.worldCupTitles = copy.titlesA ?? 0;
    teamB.worldCupTitles = copy.titlesB ?? 0;
    data = {
      mode: "match", date: dateStr, kickoff: fixture.kickoff, venue: fixture.venue,
      teamA, teamB, hook: copy.hook, facts: copy.facts.slice(0, 3), question: copy.question, music,
    };
    console.log(`✅ MATCH mode: ${teamA.name} vs ${teamB.name}`);
  } else {
    console.log("ℹ️  No fixture found from any source — switching to THROWBACK mode");
    const tb = await askClaude(throwbackPrompt());
    const [teamA, teamB] = await Promise.all([getCountry(tb.teamA), getCountry(tb.teamB)]);
    teamA.worldCupTitles = tb.titlesA ?? 0;
    teamB.worldCupTitles = tb.titlesB ?? 0;
    data = {
      mode: "throwback", date: dateStr, year: tb.year, scoreline: tb.scoreline,
      stage: tb.stage, kickoff: `${tb.stage} · Final score ${tb.scoreline}`, venue: tb.venue,
      teamA, teamB, hook: tb.hook, facts: tb.facts.slice(0, 3), question: tb.question, music,
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
