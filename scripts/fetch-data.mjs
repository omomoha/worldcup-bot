/**
 * fetch-data.mjs
 * Builds data/today.json for the Remotion render.
 *
 * Pipeline:
 *   1. API-Football  -> today's World Cup fixture (league 1, season 2026)
 *   2. REST Countries -> capital, population, flag code per team
 *   3. Claude API    -> 3 punchy facts + a hook + an engagement question
 *
 * Env vars (set in .env or GitHub Actions secrets):
 *   API_FOOTBALL_KEY   - from https://www.api-football.com (free tier OK)
 *   ANTHROPIC_API_KEY  - from https://console.anthropic.com
 *
 * If anything fails (no fixture today, missing key), the existing
 * data/today.json is left untouched so the render never breaks.
 */

import { writeFile, readFile } from "node:fs/promises";

const API_FOOTBALL_KEY = process.env.API_FOOTBALL_KEY;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const OUT = new URL("../data/today.json", import.meta.url);

// Curated fallback colors per FIFA country (extend as needed)
const TEAM_COLORS = {
  Brazil: "#FFDF00", Germany: "#DD0000", Argentina: "#75AADB", France: "#0055A4",
  England: "#CE1124", Spain: "#C60B1E", Portugal: "#006600", Netherlands: "#FF6600",
  Nigeria: "#008751", Senegal: "#00853F", Morocco: "#C1272D", Ghana: "#FCD116",
  USA: "#3C3B6E", Mexico: "#006847", Canada: "#FF0000", Japan: "#BC002D",
};

const todayISO = () => new Date().toISOString().slice(0, 10);

async function getFixture() {
  const res = await fetch(
    `https://v3.football.api-sports.io/fixtures?league=1&season=2026&date=${todayISO()}`,
    { headers: { "x-apisports-key": API_FOOTBALL_KEY } }
  );
  const json = await res.json();
  const fx = json.response?.[0];
  if (!fx) throw new Error("No World Cup fixture today");
  return {
    teamA: fx.teams.home.name,
    teamB: fx.teams.away.name,
    kickoff: new Date(fx.fixture.date).toUTCString().slice(17, 22) + " GMT",
    venue: `${fx.fixture.venue.name}, ${fx.fixture.venue.city}`,
  };
}

async function getCountry(name) {
  const res = await fetch(
    `https://restcountries.com/v3.1/name/${encodeURIComponent(name)}?fields=cca2,capital,population`
  );
  const [c] = await res.json();
  const pop = c.population >= 1e9 ? `${(c.population / 1e9).toFixed(1)}B`
            : c.population >= 1e6 ? `${Math.round(c.population / 1e6)}M`
            : `${Math.round(c.population / 1e3)}K`;
  return {
    name,
    code: c.cca2.toLowerCase(),
    capital: c.capital?.[0] ?? "—",
    population: pop,
    color: TEAM_COLORS[name] ?? "#E8B83A",
    worldCupTitles: 0, // filled by Claude below
  };
}

async function generateCopy(teamA, teamB) {
  const prompt = `Today's 2026 World Cup match: ${teamA.name} vs ${teamB.name}.
Write content for a 28-second TikTok fact video. Respond with ONLY a JSON object, no markdown fences:
{
  "hook": "one-line hook, max 10 words",
  "facts": ["3 short, surprising, TRUE facts about these two countries' World Cup history or football culture, each max 20 words"],
  "question": "a fun prediction question, max 6 words",
  "titlesA": <number of World Cup titles ${teamA.name} has won>,
  "titlesB": <number of World Cup titles ${teamB.name} has won>
}`;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-5",
      max_tokens: 600,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  const json = await res.json();
  const text = json.content?.map((b) => b.text ?? "").join("") ?? "";
  return JSON.parse(text.replace(/```json|```/g, "").trim());
}

async function main() {
  if (!API_FOOTBALL_KEY) throw new Error("API_FOOTBALL_KEY not set");

  const fixture = await getFixture();
  const [teamA, teamB] = await Promise.all([
    getCountry(fixture.teamA),
    getCountry(fixture.teamB),
  ]);

  let copy = {
    hook: `${teamA.name} vs ${teamB.name} — match day.`,
    facts: [
      `${teamA.name} and ${teamB.name} meet today at the 2026 World Cup.`,
      `Kickoff is at ${fixture.kickoff}.`,
      `Venue: ${fixture.venue}.`,
    ],
    question: "Who wins this one?",
    titlesA: 0,
    titlesB: 0,
  };
  if (ANTHROPIC_API_KEY) {
    try {
      copy = await generateCopy(teamA, teamB);
    } catch (e) {
      console.warn("Claude copy generation failed, using template copy:", e.message);
    }
  }

  teamA.worldCupTitles = copy.titlesA ?? 0;
  teamB.worldCupTitles = copy.titlesB ?? 0;

  const data = {
    date: new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }),
    kickoff: fixture.kickoff,
    venue: fixture.venue,
    teamA,
    teamB,
    hook: copy.hook,
    facts: copy.facts.slice(0, 3),
    question: copy.question,
  };

  await writeFile(OUT, JSON.stringify(data, null, 2));
  console.log("✅ data/today.json written:", `${teamA.name} vs ${teamB.name}`);
}

main().catch(async (e) => {
  console.warn(`⚠️  ${e.message} — keeping existing data/today.json`);
  // Exit 0 so the pipeline can still render evergreen/sample content,
  // or exit 1 here instead if you prefer to skip posting on no-fixture days.
  const existing = await readFile(OUT, "utf8").catch(() => null);
  process.exit(existing ? 0 : 1);
});
