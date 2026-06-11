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
const OUT = new URL("../data/matches.json", import.meta.url);

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

const DATE_OFFSET = parseInt(process.env.DATE_OFFSET ?? "0", 10);
const targetDate = () => { const d = new Date(); d.setUTCDate(d.getUTCDate() + DATE_OFFSET); return d; };

// ---- Complete FIFA-nation flag map (ISO 3166 codes for flagcdn) ----
// Covers all member associations + common name variants from fixture APIs.
const FLAG_CODES = {
  // UEFA
  "albania":"al","andorra":"ad","armenia":"am","austria":"at","azerbaijan":"az","belarus":"by",
  "belgium":"be","bosnia and herzegovina":"ba","bosnia-herzegovina":"ba","bosnia":"ba","bulgaria":"bg",
  "croatia":"hr","cyprus":"cy","czechia":"cz","czech republic":"cz","denmark":"dk","england":"gb-eng",
  "estonia":"ee","faroe islands":"fo","finland":"fi","france":"fr","georgia":"ge","germany":"de",
  "gibraltar":"gi","greece":"gr","hungary":"hu","iceland":"is","israel":"il","italy":"it",
  "kazakhstan":"kz","kosovo":"xk","latvia":"lv","liechtenstein":"li","lithuania":"lt","luxembourg":"lu",
  "malta":"mt","moldova":"md","monaco":"mc","montenegro":"me","netherlands":"nl","north macedonia":"mk",
  "macedonia":"mk","northern ireland":"gb-nir","norway":"no","poland":"pl","portugal":"pt",
  "republic of ireland":"ie","ireland":"ie","romania":"ro","russia":"ru","san marino":"sm",
  "scotland":"gb-sct","serbia":"rs","slovakia":"sk","slovenia":"si","spain":"es","sweden":"se",
  "switzerland":"ch","turkey":"tr","turkiye":"tr","ukraine":"ua","wales":"gb-wls",
  // CONMEBOL
  "argentina":"ar","bolivia":"bo","brazil":"br","chile":"cl","colombia":"co","ecuador":"ec",
  "paraguay":"py","peru":"pe","uruguay":"uy","venezuela":"ve",
  // CONCACAF
  "anguilla":"ai","antigua and barbuda":"ag","aruba":"aw","bahamas":"bs","barbados":"bb","belize":"bz",
  "bermuda":"bm","british virgin islands":"vg","canada":"ca","cayman islands":"ky","costa rica":"cr",
  "cuba":"cu","curacao":"cw","dominica":"dm","dominican republic":"do","el salvador":"sv","grenada":"gd",
  "guatemala":"gt","guyana":"gy","haiti":"ht","honduras":"hn","jamaica":"jm","mexico":"mx",
  "montserrat":"ms","nicaragua":"ni","panama":"pa","puerto rico":"pr","saint kitts and nevis":"kn",
  "saint lucia":"lc","saint vincent and the grenadines":"vc","suriname":"sr","trinidad and tobago":"tt",
  "turks and caicos islands":"tc","united states":"us","usa":"us","us virgin islands":"vi",
  // CAF
  "algeria":"dz","angola":"ao","benin":"bj","botswana":"bw","burkina faso":"bf","burundi":"bi",
  "cameroon":"cm","cape verde":"cv","cabo verde":"cv","central african republic":"cf","chad":"td",
  "comoros":"km","congo":"cg","dr congo":"cd","congo dr":"cd","democratic republic of the congo":"cd",
  "ivory coast":"ci","cote d'ivoire":"ci","côte d'ivoire":"ci","djibouti":"dj","egypt":"eg",
  "equatorial guinea":"gq","eritrea":"er","eswatini":"sz","ethiopia":"et","gabon":"ga","gambia":"gm",
  "ghana":"gh","guinea":"gn","guinea-bissau":"gw","kenya":"ke","lesotho":"ls","liberia":"lr",
  "libya":"ly","madagascar":"mg","malawi":"mw","mali":"ml","mauritania":"mr","mauritius":"mu",
  "morocco":"ma","mozambique":"mz","namibia":"na","niger":"ne","nigeria":"ng","rwanda":"rw",
  "sao tome and principe":"st","senegal":"sn","seychelles":"sc","sierra leone":"sl","somalia":"so",
  "south africa":"za","south sudan":"ss","sudan":"sd","tanzania":"tz","togo":"tg","tunisia":"tn",
  "uganda":"ug","zambia":"zm","zimbabwe":"zw",
  // AFC
  "afghanistan":"af","australia":"au","bahrain":"bh","bangladesh":"bd","bhutan":"bt","brunei":"bn",
  "cambodia":"kh","china":"cn","china pr":"cn","chinese taipei":"tw","guam":"gu","hong kong":"hk",
  "india":"in","indonesia":"id","iran":"ir","ir iran":"ir","iraq":"iq","japan":"jp","jordan":"jo",
  "kuwait":"kw","kyrgyzstan":"kg","kyrgyz republic":"kg","laos":"la","lebanon":"lb","macau":"mo",
  "malaysia":"my","maldives":"mv","mongolia":"mn","myanmar":"mm","nepal":"np","north korea":"kp",
  "korea dpr":"kp","oman":"om","pakistan":"pk","palestine":"ps","philippines":"ph","qatar":"qa",
  "saudi arabia":"sa","singapore":"sg","south korea":"kr","korea republic":"kr","sri lanka":"lk",
  "syria":"sy","tajikistan":"tj","thailand":"th","timor-leste":"tl","turkmenistan":"tm",
  "united arab emirates":"ae","uae":"ae","uzbekistan":"uz","vietnam":"vn","yemen":"ye",
  // OFC
  "american samoa":"as","cook islands":"ck","fiji":"fj","new caledonia":"nc","new zealand":"nz",
  "papua new guinea":"pg","samoa":"ws","solomon islands":"sb","tahiti":"pf","tonga":"to","vanuatu":"vu",
};

const normalize = (s) =>
  s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim();

const todayISO = () => targetDate().toISOString().slice(0, 10);

function getTeam(rawName) {
  const name = rawName.replace(/ U2[0-9]| W$/g, "").trim();
  // 1. Curated dataset (color + titles for major teams)
  const curated = TEAMS[name] ?? TEAMS[Object.keys(TEAMS).find((k) => normalize(k) === normalize(name)) ?? ""];
  // 2. Complete FIFA flag map (every nation + name variants)
  const flagCode = curated?.code
    ?? FLAG_CODES[normalize(name)]
    ?? FLAG_CODES[Object.keys(FLAG_CODES).find((k) => normalize(name).includes(k) || k.includes(normalize(name))) ?? ""];
  if (!flagCode) {
    // 3. This should be unreachable for any real national team — fail loudly
    //    rather than ship a generic flag.
    throw new Error(`No flag mapping for "${name}" — add it to FLAG_CODES in scripts/fetch-data.mjs`);
  }
  return {
    name,
    code: flagCode,
    color: curated?.color ?? "#E8B83A",
    worldCupTitles: curated?.titles ?? 0,
    stats: [],
  };
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
  const ms = ((await res.json()).matches ?? []).filter((x) => x.homeTeam?.name && x.awayTeam?.name);
  return ms.map((m) => ({
    teamA: m.homeTeam.name, teamB: m.awayTeam.name,
    kickoffISO: m.utcDate,
    kickoff: new Date(m.utcDate).toUTCString().slice(17, 22) + " GMT",
    venue: m.venue ?? "2026 FIFA World Cup",
  }));
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
  return (json.response ?? []).map((fx) => ({
    teamA: fx.teams.home.name, teamB: fx.teams.away.name,
    kickoffISO: fx.fixture.date,
    kickoff: new Date(fx.fixture.date).toUTCString().slice(17, 22) + " GMT",
    venue: `${fx.fixture.venue?.name ?? ""}${fx.fixture.venue?.city ? ", " + fx.fixture.venue.city : ""}` || "2026 FIFA World Cup",
  }));
}

async function fromTheSportsDB() {
  const res = await fetch(
    `https://www.thesportsdb.com/api/v1/json/3/eventsday.php?d=${todayISO()}&l=FIFA%20World%20Cup`
  );
  if (!res.ok) { console.warn(`thesportsdb: HTTP ${res.status}`); return null; }
  const es = ((await res.json()).events ?? []).filter((x) => x.strHomeTeam && x.strAwayTeam);
  return es.map((e) => ({
    teamA: e.strHomeTeam, teamB: e.strAwayTeam,
    kickoffISO: `${todayISO()}T${e.strTime ?? "12:00:00"}Z`,
    kickoff: e.strTime ? e.strTime.slice(0, 5) + " GMT" : "Match day",
    venue: e.strVenue ?? "2026 FIFA World Cup",
  }));
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
  "hook": "a scroll-stopping curiosity hook, max 8 words — tension, a number, or a rivalry angle. NOT just the team names.",
  "tease": "a 3-5 word retention tease pointing at fact #3, e.g. wait for #3",
  "statsA": ["2 short FOOTBALL stat lines about ${a}, max 5 words each (HARD limit), e.g. best finish, appearances, a record"],
  "statsB": ["2 short FOOTBALL stat lines about ${b}, max 5 words each (HARD limit)"],
  "facts": ["3 short, verifiably TRUE football facts about these nations' World Cup history, max 20 words each, ORDERED from least to most surprising — #3 must be the jaw-dropper"],
  "question": "a comment-bait question asking for a score prediction or hot take, max 6 words",
  "quiz": {"question": "an either-or or true/false question about these teams' World Cup history, max 12 words, with a verifiably true answer", "answer": "the answer with its key fact, max 10 words"},
  "caption": "a TikTok caption written like a real football fan typed it on their phone — casual, energetic, lowercase ok, 1-2 sentences plus 3-4 hashtags including #WorldCup2026. No corporate tone, no quotation marks."
}`;

const throwbackPrompt = () => `Pick ONE iconic, well-documented World Cup match from history (1930-2022) that you are CERTAIN about. ${RULES}
Respond with ONLY a JSON object, no markdown fences:
{
  "teamA": "country", "teamB": "country", "year": <year>, "scoreline": "e.g. 2-1 (a.e.t.)",
  "stage": "e.g. Final, Semi-final", "venue": "stadium, city",
  "hook": "a scroll-stopping curiosity hook, max 8 words — tension, a number, or a rivalry angle. NOT just the team names.",
  "tease": "a 3-5 word retention tease pointing at fact #3, e.g. wait for #3",
  "statsA": ["2 short FOOTBALL stat lines about teamA, max 5 words each (HARD limit)"],
  "statsB": ["2 short FOOTBALL stat lines about teamB, max 5 words each (HARD limit)"],
  "facts": ["3 short, specific, verifiably TRUE facts about that match with names/numbers, max 20 words each, ORDERED least to most surprising"],
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


// ---- Deterministic variety: hash of date+teams picks the structural variant ----
function hashStr(s) { let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; }
function pickVariant(seedStr, i) {
  const h = hashStr(seedStr + i);
  return {
    intro: ["center", "left"][(h >> 1) % 2],
    vs: ["diagonal", "horizontal"][(h >> 3) % 2],
    fact: ["card", "poster"][(h >> 5) % 2],
    quiz: ((h >> 7) % 2) === 0,
  };
}


// ---- Length budgets: text that fits the layout, enforced before render ----
const LIMITS = { stat: 42, hook: 56, fact: 130, question: 44 };
function fitLine(s, max) {
  if (!s) return s;
  s = s.trim();
  if (s.length <= max) return s;
  const cut = s.slice(0, max + 1).lastIndexOf(" ");
  return s.slice(0, cut > max * 0.6 ? cut : max).trim();
}
const fitStats = (arr) => (arr ?? []).map((s) => fitLine(s, LIMITS.stat)).filter(Boolean);

function titleLine(t) {
  return t.worldCupTitles > 0
    ? `${t.worldCupTitles}x World Cup champions`
    : `Chasing a first World Cup title`;
}

async function main() {
  if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is required");

  const music = existsSync(new URL("../public/music.mp3", import.meta.url));
  const dateStr = targetDate().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

  // ---- Multi-source fixtures with per-match consensus ----
  const bySource = {};
  for (const [name, fn] of [["football-data.org", fromFootballData], ["api-football", fromApiFootball], ["thesportsdb", fromTheSportsDB]]) {
    try {
      const list = (await fn()) ?? [];
      bySource[name] = list;
      console.log(`source ${name}: ${list.length} fixture(s)` + (list.length ? " — " + list.map((f) => `${f.teamA} vs ${f.teamB}`).join("; ") : ""));
    } catch (e) { console.warn(`source ${name} failed:`, e.message); bySource[name] = []; }
  }
  const reporting = Object.values(bySource).filter((l) => l.length > 0).length;
  const votes = {};
  for (const [name, list] of Object.entries(bySource)) {
    for (const f of list) {
      const k = pairKey(f);
      votes[k] ??= { count: 0, fixture: null };
      votes[k].count += 1;
      // prefer football-data.org's version of the details
      if (!votes[k].fixture || name === "football-data.org") votes[k].fixture = f;
    }
  }
  let fixtures = Object.values(votes)
    .filter((v) => (reporting >= 2 ? v.count >= 2 : true))
    .map((v) => v.fixture)
    .sort((a, b) => (a.kickoffISO ?? "").localeCompare(b.kickoffISO ?? ""));
  const dropped = Object.values(votes).length - fixtures.length;
  if (dropped > 0) console.warn(`⚠️ ${dropped} fixture(s) reported by only one source were dropped (no consensus)`);
  console.log(`✅ ${fixtures.length} confirmed fixture(s) for ${todayISO()}`);

  const SKINS = ["pitch", "electric", "heat"];
  const matches = [];

  if (fixtures.length > 0) {
    for (let i = 0; i < fixtures.length; i++) {
      const fixture = fixtures[i];
      const teamA = getTeam(fixture.teamA);
      const teamB = getTeam(fixture.teamB);
      const copy = await askClaude(matchPrompt(teamA.name, teamB.name));
      teamA.stats = fitStats([titleLine(teamA), ...(await verified(copy.statsA ?? [], `${teamA.name}'s football record`))]).slice(0, 3);
      teamB.stats = fitStats([titleLine(teamB), ...(await verified(copy.statsB ?? [], `${teamB.name}'s football record`))]).slice(0, 3);
      const facts = await verified(copy.facts.slice(0, 3), `the ${teamA.name} vs ${teamB.name} World Cup matchup`);
      while (facts.length < 3) facts.push(`${teamA.name} and ${teamB.name} meet at the 2026 World Cup — ${fixture.venue}.`);
      const variant = pickVariant(todayISO() + teamA.name + teamB.name, i);
      let quiz = null;
      if (variant.quiz && copy.quiz?.question && copy.quiz?.answer) {
        const qok = await verified([`Q: ${copy.quiz.question} A: ${copy.quiz.answer}`], `${teamA.name} vs ${teamB.name} World Cup quiz`);
        if (qok.length) quiz = copy.quiz;
        else { variant.quiz = false; console.log("ℹ️ quiz dropped by verification — using a normal fact card"); }
      } else { variant.quiz = false; }
      matches.push({
        mode: "match", skin: SKINS[i % SKINS.length], variant, quiz, date: dateStr, kickoff: fixture.kickoff, venue: fixture.venue,
        teamA, teamB, hook: fitLine(copy.hook, LIMITS.hook), tease: copy.tease ?? "wait for #3 🤯",
        facts: facts.slice(0, 3), question: fitLine(copy.question, LIMITS.question),
        caption: copy.caption ?? `${teamA.name} vs ${teamB.name} 👀 who's taking it? #WorldCup2026 #football`,
        pinnedComment: `📍 ${fixture.venue}\n🕕 Kickoff: ${fixture.kickoff}\n📅 ${dateStr}\n\nWho are you backing? 👇`,
        music,
      });
      console.log(`✅ video ${i + 1}: ${teamA.name} vs ${teamB.name} [skin: ${SKINS[i % SKINS.length]}]`);
    }
  } else {
    console.log("ℹ️ No fixtures from any source — THROWBACK mode");
    const tb = await askClaude(throwbackPrompt());
    const teamA = getTeam(tb.teamA);
    const teamB = getTeam(tb.teamB);
    teamA.stats = fitStats([titleLine(teamA), ...(await verified(tb.statsA ?? [], `${teamA.name}'s football record`))]).slice(0, 3);
    teamB.stats = fitStats([titleLine(teamB), ...(await verified(tb.statsB ?? [], `${teamB.name}'s football record`))]).slice(0, 3);
    const facts = await verified(tb.facts.slice(0, 3), `the ${tb.year} ${tb.stage} between ${teamA.name} and ${teamB.name}`);
    if (facts.length < 2) throw new Error("Throwback facts failed verification — refusing to publish uncertain content");
    matches.push({
      mode: "throwback", skin: "archive", variant: { ...pickVariant(todayISO() + teamA.name, 0), quiz: false }, quiz: null, date: dateStr, year: tb.year, scoreline: tb.scoreline, stage: tb.stage,
      kickoff: `${tb.stage} · Final score ${tb.scoreline}`, venue: tb.venue,
      teamA, teamB, hook: fitLine(tb.hook, LIMITS.hook), tease: tb.tease ?? "#3 is wild 🤯",
      facts: facts.slice(0, 3), question: fitLine(tb.question, LIMITS.question),
      caption: tb.caption ?? `throwback to ${teamA.name} vs ${teamB.name}, ${tb.year} 🔥 #WorldCup #throwback`,
      pinnedComment: `📍 ${tb.venue}\n🏆 ${tb.stage}, ${tb.year} — final score ${tb.scoreline}\n\nWere you watching? 👇`,
      music,
    });
    console.log(`✅ THROWBACK: ${teamA.name} vs ${teamB.name}, ${tb.year}`);
  }

  await writeFile(OUT, JSON.stringify(matches, null, 2));
}

main().catch((e) => {
  console.error(`❌ ${e.message}`);
  process.exit(1); // better no video than a wrong one
});
