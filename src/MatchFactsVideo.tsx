import React from "react";
import {
  AbsoluteFill,
  Audio,
  Img,
  Sequence,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { loadFont as loadAnton } from "@remotion/google-fonts/Anton";
import { loadFont as loadInter } from "@remotion/google-fonts/Inter";

const { fontFamily: DISPLAY } = loadAnton();
const { fontFamily: BODY } = loadInter();

// ---------- Types ----------
export type Team = {
  name: string;
  code: string;
  color: string;
  capital: string;
  population: string;
  worldCupTitles: number;
};

export type MatchData = {
  mode: "match" | "throwback";
  date: string;
  year?: number; // throwback only
  scoreline?: string; // throwback only
  stage?: string; // throwback only
  kickoff: string;
  venue: string;
  teamA: Team;
  teamB: Team;
  hook: string;
  facts: string[];
  question: string;
  music?: boolean;
};

// ---------- Themes ----------
// MATCH DAY: night pitch + gold. THROWBACK: archival charcoal + cream + vermilion.
const THEMES = {
  match: {
    bg: "radial-gradient(120% 80% at 50% 0%, #0A2E20 0%, #051A11 75%)",
    base: "#051A11",
    text: "#F7F4EC",
    accent: "#E8B83A",
    line: "rgba(247,244,236,0.18)",
    eyebrow: (d: MatchData) => `MATCH DAY · ${d.date.toUpperCase()}`,
    factLabel: "DID YOU KNOW?",
    cta: "Drop your prediction ⬇ + follow for daily facts",
    grain: false,
  },
  throwback: {
    bg: "radial-gradient(120% 80% at 50% 0%, #2A2118 0%, #16110B 75%)",
    base: "#16110B",
    text: "#F2E8D5",
    accent: "#D6502B",
    line: "rgba(242,232,213,0.16)",
    eyebrow: (d: MatchData) => `⏪ THROWBACK · ${d.stage?.toUpperCase() ?? "CLASSIC"} ${d.year ?? ""}`,
    factLabel: "FROM THE ARCHIVE",
    cta: "Were you watching? Tell us below ⬇",
    grain: true,
  },
} as const;

const flagUrl = (code: string) => `https://flagcdn.com/w640/${code}.png`;

// Film-grain-ish overlay for the throwback look
const Grain: React.FC = () => (
  <AbsoluteFill
    style={{
      background:
        "repeating-linear-gradient(0deg, rgba(0,0,0,0.13) 0px, transparent 2px, transparent 5px)",
      mixBlendMode: "overlay",
      pointerEvents: "none",
    }}
  />
);

const PitchFrame: React.FC<{ line: string }> = ({ line }) => (
  <AbsoluteFill style={{ padding: 48 }}>
    <div style={{ width: "100%", height: "100%", border: `4px solid ${line}`, borderRadius: 8 }} />
    <div
      style={{
        position: "absolute", left: "50%", bottom: -260, transform: "translateX(-50%)",
        width: 620, height: 620, border: `4px solid ${line}`, opacity: 0.7, borderRadius: "50%",
      }}
    />
  </AbsoluteFill>
);

// Giant year stamp watermark (throwback only)
const YearStamp: React.FC<{ year?: number; color: string }> = ({ year, color }) =>
  year ? (
    <div
      style={{
        position: "absolute", bottom: 90, left: 0, right: 0, textAlign: "center",
        fontFamily: DISPLAY, fontSize: 130, color, opacity: 0.18, letterSpacing: 20,
      }}
    >
      {year}
    </div>
  ) : null;

// ---------- Scene 1: Title ----------
const SceneTitle: React.FC<{ data: MatchData }> = ({ data }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = THEMES[data.mode];
  const punch = spring({ frame, fps, config: { damping: 12, mass: 0.6 } });
  const sub = spring({ frame: frame - 12, fps, config: { damping: 200 } });

  return (
    <AbsoluteFill style={{ background: t.bg, justifyContent: "center", alignItems: "center" }}>
      <PitchFrame line={t.line} />
      <YearStamp year={data.mode === "throwback" ? data.year : undefined} color={t.accent} />
      <div style={{ fontFamily: BODY, color: t.accent, fontSize: 44, fontWeight: 700, letterSpacing: 14, opacity: sub, textAlign: "center", padding: "0 60px" }}>
        {t.eyebrow(data)}
      </div>
      <div
        style={{
          fontFamily: DISPLAY, color: t.text, fontSize: 150, lineHeight: 1.02, textAlign: "center",
          transform: `scale(${0.7 + punch * 0.3})`, margin: "30px 60px 0",
        }}
      >
        {data.teamA.name.toUpperCase()}
        <span style={{ color: t.accent, display: "block", fontSize: 85 }}>
          {data.mode === "throwback" ? data.scoreline ?? "VS" : "VS"}
        </span>
        {data.teamB.name.toUpperCase()}
      </div>
      <div style={{ fontFamily: BODY, color: t.text, fontSize: 38, marginTop: 50, opacity: sub, textAlign: "center", padding: "0 60px" }}>
        {data.mode === "throwback" ? data.venue : `${data.kickoff} · ${data.venue}`}
      </div>
      {t.grain && <Grain />}
    </AbsoluteFill>
  );
};

// ---------- Scene 2: Diagonal head-to-head ----------
const SceneVersus: React.FC<{ data: MatchData }> = ({ data }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = THEMES[data.mode];
  const slideA = spring({ frame, fps, config: { damping: 200 } });
  const slideB = spring({ frame: frame - 8, fps, config: { damping: 200 } });

  const half = (team: Team, top: boolean, slide: number) => (
    <div
      style={{
        position: "absolute", inset: 0,
        clipPath: top ? "polygon(0 0, 100% 0, 100% 38%, 0 62%)" : "polygon(0 62%, 100% 38%, 100% 100%, 0 100%)",
        background: `linear-gradient(${top ? 160 : 340}deg, ${team.color}${data.mode === "throwback" ? "88" : "cc"}, ${t.base})`,
        transform: `translateX(${(top ? -1 : 1) * (1 - slide) * 1080}px)`,
        filter: data.mode === "throwback" ? "saturate(0.7) sepia(0.25)" : undefined,
      }}
    >
      <Img
        src={flagUrl(team.code)}
        style={{
          position: "absolute", width: 560, borderRadius: 16,
          boxShadow: "0 30px 80px rgba(0,0,0,0.5)",
          ...(top ? { top: 200, left: 80 } : { bottom: 200, right: 80 }),
        }}
      />
      <div style={{ position: "absolute", fontFamily: DISPLAY, color: t.text, fontSize: 110, ...(top ? { top: 560, left: 84 } : { bottom: 560, right: 84, textAlign: "right" as const }) }}>
        {team.name.toUpperCase()}
      </div>
      <div style={{ position: "absolute", fontFamily: BODY, color: t.text, fontSize: 38, lineHeight: 1.6, opacity: 0.9, ...(top ? { top: 700, left: 88 } : { bottom: 700, right: 88, textAlign: "right" as const }) }}>
        Capital: {team.capital}<br />
        Population: {team.population}<br />
        World Cup titles: {team.worldCupTitles} {"★".repeat(Math.min(team.worldCupTitles, 5))}
      </div>
    </div>
  );

  return (
    <AbsoluteFill style={{ backgroundColor: t.base }}>
      {half(data.teamA, true, slideA)}
      {half(data.teamB, false, slideB)}
      <div
        style={{
          position: "absolute", top: "50%", left: "50%",
          transform: `translate(-50%, -50%) rotate(-8deg) scale(${slideB})`,
          fontFamily: DISPLAY, fontSize: data.mode === "throwback" ? 130 : 200,
          color: t.accent, textShadow: "0 10px 40px rgba(0,0,0,0.6)", whiteSpace: "nowrap",
        }}
      >
        {data.mode === "throwback" ? data.scoreline ?? "VS" : "VS"}
      </div>
      {t.grain && <Grain />}
    </AbsoluteFill>
  );
};

// ---------- Scene 3: Fact cards ----------
const FactCard: React.FC<{ data: MatchData; fact: string; index: number }> = ({ data, fact, index }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = THEMES[data.mode];
  const rise = spring({ frame, fps, config: { damping: 200 } });
  const accent = index % 2 === 0 ? data.teamA.color : data.teamB.color;

  return (
    <AbsoluteFill style={{ background: t.bg, justifyContent: "center", alignItems: "center" }}>
      <PitchFrame line={t.line} />
      <YearStamp year={data.mode === "throwback" ? data.year : undefined} color={t.accent} />
      <div style={{ fontFamily: BODY, fontWeight: 800, color: t.accent, fontSize: 46, letterSpacing: 10, marginBottom: 40, opacity: rise }}>
        {t.factLabel} · {index + 1}/3
      </div>
      <div
        style={{
          width: 880, background: data.mode === "throwback" ? "rgba(242,232,213,0.05)" : "rgba(247,244,236,0.06)",
          border: `3px ${data.mode === "throwback" ? "dashed" : "solid"} ${data.mode === "throwback" ? t.accent : accent}`,
          borderRadius: data.mode === "throwback" ? 6 : 24,
          padding: "70px 60px",
          transform: `translateY(${(1 - rise) * 300}px)`, opacity: rise,
        }}
      >
        <div style={{ fontFamily: DISPLAY, color: t.text, fontSize: 70, lineHeight: 1.25, textAlign: "center" }}>
          {fact}
        </div>
      </div>
      {t.grain && <Grain />}
    </AbsoluteFill>
  );
};

// ---------- Scene 4: Outro / CTA ----------
const SceneOutro: React.FC<{ data: MatchData }> = ({ data }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = THEMES[data.mode];
  const inA = spring({ frame, fps, config: { damping: 200 } });
  const pulse = 1 + Math.sin(frame / 8) * 0.03;

  return (
    <AbsoluteFill style={{ background: t.bg, justifyContent: "center", alignItems: "center" }}>
      <PitchFrame line={t.line} />
      <YearStamp year={data.mode === "throwback" ? data.year : undefined} color={t.accent} />
      <div style={{ display: "flex", gap: 40, opacity: inA, filter: data.mode === "throwback" ? "saturate(0.7) sepia(0.25)" : undefined }}>
        <Img src={flagUrl(data.teamA.code)} style={{ width: 300, borderRadius: 12 }} />
        <Img src={flagUrl(data.teamB.code)} style={{ width: 300, borderRadius: 12 }} />
      </div>
      <div style={{ fontFamily: DISPLAY, color: t.text, fontSize: 92, textAlign: "center", margin: "70px 80px 0", lineHeight: 1.15, opacity: inA }}>
        {data.question.toUpperCase()}
      </div>
      <div
        style={{
          fontFamily: BODY, fontWeight: 700, color: t.base, background: t.accent,
          fontSize: 42, padding: "26px 60px", borderRadius: 999, marginTop: 80,
          transform: `scale(${pulse})`,
        }}
      >
        {t.cta}
      </div>
      {t.grain && <Grain />}
    </AbsoluteFill>
  );
};

// ---------- Main composition ----------
export const MatchFactsVideo: React.FC<MatchData> = (data) => {
  const { fps } = useVideoConfig();
  const s = (sec: number) => Math.round(sec * fps);

  return (
    <AbsoluteFill style={{ backgroundColor: THEMES[data.mode].base }}>
      {data.music && <Audio src={staticFile("music.mp3")} volume={0.5} />}
      <Sequence durationInFrames={s(3.5)}>
        <SceneTitle data={data} />
      </Sequence>
      <Sequence from={s(3.5)} durationInFrames={s(6.5)}>
        <SceneVersus data={data} />
      </Sequence>
      {data.facts.slice(0, 3).map((fact, i) => (
        <Sequence key={i} from={s(10 + i * 4.5)} durationInFrames={s(4.5)}>
          <FactCard data={data} fact={fact} index={i} />
        </Sequence>
      ))}
      <Sequence from={s(23.5)} durationInFrames={s(4.5)}>
        <SceneOutro data={data} />
      </Sequence>
    </AbsoluteFill>
  );
};
