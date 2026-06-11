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
  worldCupTitles: number;
  stats: string[];
};

export type MatchData = {
  mode: "match" | "throwback";
  skin?: string; // pitch | electric | heat | archive
  date: string;
  year?: number;
  scoreline?: string;
  stage?: string;
  kickoff: string;
  venue: string;
  teamA: Team;
  teamB: Team;
  hook: string;
  tease?: string; // retention tease, e.g. "wait for #3 🤯"
  facts: string[]; // ordered: most surprising LAST
  question: string;
  caption?: string;
  music?: boolean;
};

// ---------- Themes ----------
// Rotating skins so consecutive videos never look identical.
// "pitch" = night grass + gold · "electric" = midnight + cyan · "heat" = ember + orange
const THEMES = {
  pitch: {
    bg: "radial-gradient(120% 80% at 50% 0%, #0A2E20 0%, #051A11 75%)",
    base: "#051A11", text: "#F7F4EC", accent: "#E8B83A",
    line: "rgba(247,244,236,0.18)", factLabel: "DID YOU KNOW?",
    grain: false, flip: false, cardRadius: 24,
  },
  electric: {
    bg: "radial-gradient(120% 80% at 50% 100%, #101A3E 0%, #05070F 75%)",
    base: "#05070F", text: "#EEF4FF", accent: "#4EE1FF",
    line: "rgba(238,244,255,0.16)", factLabel: "DID YOU KNOW?",
    grain: false, flip: true, cardRadius: 0,
  },
  heat: {
    bg: "radial-gradient(120% 80% at 0% 0%, #3A1208 0%, #170502 75%)",
    base: "#170502", text: "#FFF3E8", accent: "#FF7A3C",
    line: "rgba(255,243,232,0.16)", factLabel: "DID YOU KNOW?",
    grain: false, flip: false, cardRadius: 48,
  },
  archive: {
    bg: "radial-gradient(120% 80% at 50% 0%, #2A2118 0%, #16110B 75%)",
    base: "#16110B", text: "#F2E8D5", accent: "#D6502B",
    line: "rgba(242,232,213,0.16)", factLabel: "FROM THE ARCHIVE",
    grain: true, flip: false, cardRadius: 6,
  },
} as const;

export type Skin = keyof typeof THEMES;
const getTheme = (data: MatchData) =>
  data.mode === "throwback" ? THEMES.archive : THEMES[(data.skin as Skin) ?? "pitch"] ?? THEMES.pitch;

const flagUrl = (code: string) => `https://flagcdn.com/w640/${code}.png`;

// Scene boundaries (seconds) — keep in sync with the soundtrack's impact hits
const T_HOOK = 3.5;
const T_VS = 10.0;
const T_FACT = 4.5;
const T_OUTRO = 23.5;
const T_END = 28.0;

// ---------- Shared bits ----------
const Grain: React.FC = () => (
  <AbsoluteFill style={{ background: "repeating-linear-gradient(0deg, rgba(0,0,0,0.13) 0px, transparent 2px, transparent 5px)", mixBlendMode: "overlay", pointerEvents: "none" }} />
);

const PitchFrame: React.FC<{ line: string }> = ({ line }) => (
  <AbsoluteFill style={{ padding: 48 }}>
    <div style={{ width: "100%", height: "100%", border: `4px solid ${line}`, borderRadius: 8 }} />
    <div style={{ position: "absolute", left: "50%", bottom: -260, transform: "translateX(-50%)", width: 620, height: 620, border: `4px solid ${line}`, opacity: 0.7, borderRadius: "50%" }} />
  </AbsoluteFill>
);

// Slow ambient zoom so no frame is ever static
const Drift: React.FC<{ children: React.ReactNode; out?: boolean }> = ({ children, out }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const z = interpolate(frame, [0, durationInFrames], out ? [1.06, 1] : [1, 1.06]);
  return <AbsoluteFill style={{ transform: `scale(${z})` }}>{children}</AbsoluteFill>;
};

// Retention progress bar across the top
const ProgressBar: React.FC<{ accent: string }> = ({ accent }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pct = Math.min(1, frame / (T_END * fps));
  return (
    <div style={{ position: "absolute", top: 0, left: 0, height: 14, width: `${pct * 100}%`, background: accent, zIndex: 50 }} />
  );
};

// Word-by-word pop-in text
const PopWords: React.FC<{ text: string; style: React.CSSProperties; stagger?: number; from?: number }> = ({ text, style, stagger = 3, from = 0 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <div style={style}>
      {text.split(" ").map((w, i) => {
        const s = spring({ frame: frame - from - i * stagger, fps, config: { damping: 11, mass: 0.5 } });
        return (
          <span key={i} style={{ display: "inline-block", marginRight: "0.28em", transform: `scale(${0.4 + s * 0.6}) translateY(${(1 - s) * 40}px)`, opacity: s }}>
            {w}
          </span>
        );
      })}
    </div>
  );
};

// ---------- Scene 1: Cold-open hook ----------
const SceneHook: React.FC<{ data: MatchData }> = ({ data }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = getTheme(data);
  const sub = spring({ frame: frame - 6, fps, config: { damping: 200 } });
  const teaseIn = spring({ frame: frame - 35, fps, config: { damping: 9, mass: 0.5 } });
  const wobble = Math.sin(frame / 4) * teaseIn * 2;

  const eyebrow = data.mode === "throwback"
    ? `⏪ THROWBACK · ${data.stage?.toUpperCase() ?? "CLASSIC"} ${data.year ?? ""}`
    : `MATCH DAY · ${data.date.toUpperCase()}`;

  return (
    <AbsoluteFill style={{ background: t.bg, justifyContent: "center", alignItems: "center" }}>
      <Drift><PitchFrame line={t.line} /></Drift>
      <div style={{ fontFamily: BODY, color: t.accent, fontSize: 40, fontWeight: 800, letterSpacing: 12, opacity: sub, textAlign: "center", padding: "0 60px" }}>
        {eyebrow}
      </div>
      <PopWords
        text={data.hook.toUpperCase()}
        style={{ fontFamily: DISPLAY, color: t.text, fontSize: 118, lineHeight: 1.08, textAlign: "center", margin: "40px 70px 0" }}
      />
      <div
        style={{
          marginTop: 70, fontFamily: BODY, fontWeight: 800, fontSize: 42,
          color: t.base, background: t.accent, padding: "18px 44px", borderRadius: 999,
          transform: `scale(${teaseIn}) rotate(${wobble}deg)`,
        }}
      >
        {data.tease ?? "wait for #3 🤯"}
      </div>
      {t.grain && <Grain />}
    </AbsoluteFill>
  );
};

// ---------- Scene 2: Diagonal head-to-head ----------
const SceneVersus: React.FC<{ data: MatchData }> = ({ data }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = getTheme(data);
  const slideA = spring({ frame, fps, config: { damping: 200 } });
  const slideB = spring({ frame: frame - 8, fps, config: { damping: 200 } });
  const vsPunch = spring({ frame: frame - 14, fps, config: { damping: 8, mass: 0.7 } });

  const half = (team: Team, top: boolean, slide: number) => (
    <div
      style={{
        position: "absolute", inset: 0,
        clipPath: top
          ? (t.flip ? "polygon(0 0, 100% 0, 100% 62%, 0 38%)" : "polygon(0 0, 100% 0, 100% 38%, 0 62%)")
          : (t.flip ? "polygon(0 38%, 100% 62%, 100% 100%, 0 100%)" : "polygon(0 62%, 100% 38%, 100% 100%, 0 100%)"),
        background: `linear-gradient(${top ? 160 : 340}deg, ${team.color}${data.mode === "throwback" ? "88" : "cc"}, ${t.base})`,
        transform: `translateX(${(top ? -1 : 1) * (1 - slide) * 1080}px)`,
        filter: data.mode === "throwback" ? "saturate(0.7) sepia(0.25)" : undefined,
      }}
    >
      <Img
        src={flagUrl(team.code)}
        style={{ position: "absolute", width: 540, borderRadius: 16, boxShadow: "0 30px 80px rgba(0,0,0,0.5)", ...(top ? { top: 190, left: 80 } : { bottom: 190, right: 80 }) }}
      />
      <div style={{ position: "absolute", fontFamily: DISPLAY, color: t.text, fontSize: 104, ...(top ? { top: 540, left: 84 } : { bottom: 540, right: 84, textAlign: "right" as const }) }}>
        {team.name.toUpperCase()}
      </div>
      <div style={{ position: "absolute", fontFamily: BODY, fontWeight: 600, color: t.text, fontSize: 37, lineHeight: 1.75, ...(top ? { top: 675, left: 88 } : { bottom: 675, right: 88, textAlign: "right" as const }) }}>
        {team.stats.slice(0, 3).map((line, i) => {
          const lineIn = spring({ frame: frame - 18 - i * 8, fps, config: { damping: 200 } });
          return (
            <div key={i} style={{ opacity: lineIn, transform: `translateX(${(top ? -1 : 1) * (1 - lineIn) * 120}px)` }}>
              {i === 0 && team.worldCupTitles > 0 ? "🏆".repeat(Math.min(team.worldCupTitles, 5)) + " " : "▸ "}
              {line}
            </div>
          );
        })}
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
          transform: `translate(-50%, -50%) rotate(${t.flip ? 8 : -8}deg) scale(${0.5 + vsPunch * 0.6})`,
          fontFamily: DISPLAY, fontSize: data.mode === "throwback" ? 125 : 190,
          color: t.accent, textShadow: "0 10px 40px rgba(0,0,0,0.6)", whiteSpace: "nowrap",
        }}
      >
        {data.mode === "throwback" ? data.scoreline ?? "VS" : "VS"}
      </div>
      {t.grain && <Grain />}
    </AbsoluteFill>
  );
};

// ---------- Scene 3: Fact cards (escalating, #3 gets the hype treatment) ----------
const FactCard: React.FC<{ data: MatchData; fact: string; index: number }> = ({ data, fact, index }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = getTheme(data);
  const rise = spring({ frame, fps, config: { damping: 200 } });
  const isFinale = index === 2;
  const shake = isFinale ? Math.sin(frame / 1.6) * interpolate(frame, [0, 10, 25], [4, 4, 0], { extrapolateRight: "clamp" }) : 0;
  const badge = spring({ frame: frame - 4, fps, config: { damping: 8, mass: 0.6 } });
  const accent = isFinale ? t.accent : index % 2 === 0 ? data.teamA.color : data.teamB.color;

  return (
    <AbsoluteFill style={{ background: t.bg, justifyContent: "center", alignItems: "center" }}>
      <Drift out={index % 2 === 1}><PitchFrame line={t.line} /></Drift>
      <div
        style={{
          fontFamily: DISPLAY, fontSize: 120, color: t.base, background: accent,
          width: 170, height: 170, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
          transform: `scale(${badge}) rotate(${-8 + badge * 8}deg)`, marginBottom: 50,
          boxShadow: `0 0 ${isFinale ? 90 : 40}px ${accent}66`,
        }}
      >
        {index + 1}
      </div>
      <div style={{ fontFamily: BODY, fontWeight: 800, color: t.accent, fontSize: 42, letterSpacing: 8, marginBottom: 36, opacity: rise }}>
        {isFinale ? "🤯 THE ONE YOU WAITED FOR" : t.factLabel}
      </div>
      <div
        style={{
          width: 880, background: "rgba(255,255,255,0.05)",
          border: `${isFinale ? 5 : 3}px ${data.mode === "throwback" ? "dashed" : "solid"} ${accent}`,
          borderRadius: t.cardRadius, padding: "60px 56px",
          transform: `translateY(${(1 - rise) * 300}px) translateX(${shake}px)`, opacity: rise,
        }}
      >
        <PopWords
          text={fact}
          stagger={2}
          from={6}
          style={{ fontFamily: DISPLAY, color: t.text, fontSize: isFinale ? 76 : 68, lineHeight: 1.25, textAlign: "center" }}
        />
      </div>
      {t.grain && <Grain />}
    </AbsoluteFill>
  );
};

// ---------- Scene 4: Comment-bait outro ----------
const SceneOutro: React.FC<{ data: MatchData }> = ({ data }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = getTheme(data);
  const inA = spring({ frame, fps, config: { damping: 200 } });
  const pulse = 1 + Math.sin(frame / 7) * 0.04;
  const arrowY = Math.abs(Math.sin(frame / 9)) * 26;

  return (
    <AbsoluteFill style={{ background: t.bg, justifyContent: "center", alignItems: "center" }}>
      <Drift out><PitchFrame line={t.line} /></Drift>
      <div style={{ display: "flex", gap: 40, opacity: inA, filter: data.mode === "throwback" ? "saturate(0.7) sepia(0.25)" : undefined }}>
        <Img src={flagUrl(data.teamA.code)} style={{ width: 270, borderRadius: 12, transform: `rotate(${-4 + inA * 0}deg)` }} />
        <Img src={flagUrl(data.teamB.code)} style={{ width: 270, borderRadius: 12 }} />
      </div>
      <PopWords
        text={data.question.toUpperCase()}
        style={{ fontFamily: DISPLAY, color: t.text, fontSize: 96, textAlign: "center", margin: "60px 80px 0", lineHeight: 1.15 }}
      />
      <div style={{ fontFamily: BODY, fontWeight: 800, color: t.accent, fontSize: 46, marginTop: 46, opacity: inA }}>
        score predictions in the comments
      </div>
      <div style={{ fontSize: 80, transform: `translateY(${arrowY}px)`, marginTop: 8 }}>⬇️</div>
      <div
        style={{
          fontFamily: BODY, fontWeight: 800, color: t.base, background: t.accent,
          fontSize: 42, padding: "24px 56px", borderRadius: 999, marginTop: 30,
          transform: `scale(${pulse})`,
        }}
      >
        + follow — new one every match day
      </div>
      {t.grain && <Grain />}
    </AbsoluteFill>
  );
};

// ---------- Main composition ----------
export const MatchFactsVideo: React.FC<MatchData> = (data) => {
  const { fps } = useVideoConfig();
  const s = (sec: number) => Math.round(sec * fps);
  const t = getTheme(data);

  return (
    <AbsoluteFill style={{ backgroundColor: t.base }}>
      {data.music && <Audio src={staticFile("music.mp3")} volume={0.5} />}
      <ProgressBar accent={t.accent} />
      <Sequence durationInFrames={s(T_HOOK)}>
        <SceneHook data={data} />
      </Sequence>
      <Sequence from={s(T_HOOK)} durationInFrames={s(T_VS - T_HOOK)}>
        <SceneVersus data={data} />
      </Sequence>
      {data.facts.slice(0, 3).map((fact, i) => (
        <Sequence key={i} from={s(T_VS + i * T_FACT)} durationInFrames={s(T_FACT)}>
          <FactCard data={data} fact={fact} index={i} />
        </Sequence>
      ))}
      <Sequence from={s(T_OUTRO)} durationInFrames={s(T_END - T_OUTRO)}>
        <SceneOutro data={data} />
      </Sequence>
    </AbsoluteFill>
  );
};
