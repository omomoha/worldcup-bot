import React from "react";
import {
  AbsoluteFill, Audio, Img, OffthreadVideo, Sequence, interpolate, spring, staticFile,
  useCurrentFrame, useVideoConfig,
} from "remotion";
import { loadFont as loadAnton } from "@remotion/google-fonts/Anton";
import { loadFont as loadInter } from "@remotion/google-fonts/Inter";

const { fontFamily: DISPLAY } = loadAnton();
const { fontFamily: BODY } = loadInter();

// ---------- Types ----------
export type Team = {
  name: string; code: string; color: string; worldCupTitles: number; stats: string[];
};

export type Variant = {
  intro: "center" | "left";      // hook layout
  vs: "diagonal" | "horizontal"; // head-to-head geometry
  fact: "card" | "poster";       // fact presentation
  quiz: boolean;                 // fact #2 becomes a countdown quiz
};

export type MatchData = {
  mode: "match" | "throwback";
  skin?: string;
  variant?: Variant;
  date: string; year?: number; scoreline?: string; stage?: string;
  kickoff: string; venue: string;
  teamA: Team; teamB: Team;
  hook: string; tease?: string;
  facts: string[];
  quiz?: { question: string; answer: string };
  question: string; caption?: string; pinnedComment?: string;
  music?: boolean;
  bgVideo?: string | null; // optional stock clip behind the gradient scenes
};

// ---------- Skins ----------
const THEMES = {
  pitch:    { bg: "radial-gradient(120% 80% at 50% 0%, #0A2E20 0%, #051A11 75%)", base: "#051A11", text: "#F7F4EC", accent: "#E8B83A", line: "rgba(247,244,236,0.18)", factLabel: "DID YOU KNOW?", grain: false, cardRadius: 24 },
  electric: { bg: "radial-gradient(120% 80% at 50% 100%, #101A3E 0%, #05070F 75%)", base: "#05070F", text: "#EEF4FF", accent: "#4EE1FF", line: "rgba(238,244,255,0.16)", factLabel: "DID YOU KNOW?", grain: false, cardRadius: 0 },
  heat:     { bg: "radial-gradient(120% 80% at 0% 0%, #3A1208 0%, #170502 75%)", base: "#170502", text: "#FFF3E8", accent: "#FF7A3C", line: "rgba(255,243,232,0.16)", factLabel: "DID YOU KNOW?", grain: false, cardRadius: 48 },
  archive:  { bg: "radial-gradient(120% 80% at 50% 0%, #2A2118 0%, #16110B 75%)", base: "#16110B", text: "#F2E8D5", accent: "#D6502B", line: "rgba(242,232,213,0.16)", factLabel: "FROM THE ARCHIVE", grain: true, cardRadius: 6 },
} as const;
type Skin = keyof typeof THEMES;
const getTheme = (d: MatchData) => d.mode === "throwback" ? THEMES.archive : THEMES[(d.skin as Skin) ?? "pitch"] ?? THEMES.pitch;
const getVariant = (d: MatchData): Variant => d.variant ?? { intro: "center", vs: "diagonal", fact: "card", quiz: false };

const flagUrl = (code: string) => `https://flagcdn.com/w640/${code}.png`;

const T_HOOK = 3.5, T_VS = 10.0, T_FACT = 4.5, T_OUTRO = 23.5, T_END = 28.0;

// ---------- Shared ----------

// Live background: stock clip desaturated + tinted under the theme gradient.
// Falls back to nothing (pure gradient) when no clip was fetched.
const BgClip: React.FC<{ data: MatchData }> = ({ data }) => {
  const t = getTheme(data);
  if (!data.bgVideo) return null;
  return (
    <AbsoluteFill>
      <OffthreadVideo
        muted
        loop
        src={staticFile(data.bgVideo)}
        style={{ width: "100%", height: "100%", objectFit: "cover", filter: "saturate(0.45) brightness(0.7)" }}
      />
      <AbsoluteFill style={{ background: t.bg, opacity: 0.78 }} />
    </AbsoluteFill>
  );
};

const Grain: React.FC = () => (
  <AbsoluteFill style={{ background: "repeating-linear-gradient(0deg, rgba(0,0,0,0.13) 0px, transparent 2px, transparent 5px)", mixBlendMode: "overlay", pointerEvents: "none" }} />
);
const PitchFrame: React.FC<{ line: string }> = ({ line }) => (
  <AbsoluteFill style={{ padding: 48 }}>
    <div style={{ width: "100%", height: "100%", border: `4px solid ${line}`, borderRadius: 8 }} />
    <div style={{ position: "absolute", left: "50%", bottom: -260, transform: "translateX(-50%)", width: 620, height: 620, border: `4px solid ${line}`, opacity: 0.7, borderRadius: "50%" }} />
  </AbsoluteFill>
);
const Drift: React.FC<{ children: React.ReactNode; out?: boolean }> = ({ children, out }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const z = interpolate(frame, [0, durationInFrames], out ? [1.06, 1] : [1, 1.06]);
  return <AbsoluteFill style={{ transform: `scale(${z})` }}>{children}</AbsoluteFill>;
};
const ProgressBar: React.FC<{ accent: string }> = ({ accent }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return <div style={{ position: "absolute", top: 0, left: 0, height: 14, width: `${Math.min(1, frame / (T_END * fps)) * 100}%`, background: accent, zIndex: 50 }} />;
};
const PopWords: React.FC<{ text: string; style: React.CSSProperties; stagger?: number; from?: number }> = ({ text, style, stagger = 3, from = 0 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <div style={style}>
      {text.split(" ").map((w, i) => {
        const s = spring({ frame: frame - from - i * stagger, fps, config: { damping: 11, mass: 0.5 } });
        return <span key={i} style={{ display: "inline-block", marginRight: "0.28em", transform: `scale(${0.4 + s * 0.6}) translateY(${(1 - s) * 40}px)`, opacity: s }}>{w}</span>;
      })}
    </div>
  );
};

// ---------- Scene 1: Hook (two layouts) ----------
const SceneHook: React.FC<{ data: MatchData }> = ({ data }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = getTheme(data);
  const v = getVariant(data);
  const sub = spring({ frame: frame - 6, fps, config: { damping: 200 } });
  const teaseIn = spring({ frame: frame - 35, fps, config: { damping: 9, mass: 0.5 } });
  const wobble = Math.sin(frame / 4) * teaseIn * 2;
  const eyebrow = data.mode === "throwback"
    ? `⏪ THROWBACK · ${data.stage?.toUpperCase() ?? "CLASSIC"} ${data.year ?? ""}`
    : `MATCH DAY · ${data.date.toUpperCase()}`;
  const left = v.intro === "left";

  return (
    <AbsoluteFill style={{ background: t.bg, justifyContent: "center", alignItems: left ? "flex-start" : "center" }}>
      <BgClip data={data} />
      <Drift><PitchFrame line={t.line} /></Drift>
      {left && (
        <div style={{ position: "absolute", left: 90, top: 130, bottom: 130, width: 16, background: t.accent, transform: `scaleY(${sub})`, transformOrigin: "top" }} />
      )}
      <div style={{ fontFamily: BODY, color: t.accent, fontSize: 40, fontWeight: 800, letterSpacing: 12, opacity: sub, textAlign: left ? "left" : "center", padding: left ? "0 90px 0 150px" : "0 60px" }}>
        {eyebrow}
      </div>
      <PopWords
        text={data.hook.toUpperCase()}
        style={{ fontFamily: DISPLAY, color: t.text, fontSize: left ? 128 : 118, lineHeight: 1.06, textAlign: left ? "left" : "center", margin: left ? "40px 90px 0 150px" : "40px 70px 0" }}
      />
      <div style={{ marginTop: 70, marginLeft: left ? 150 : 0, fontFamily: BODY, fontWeight: 800, fontSize: 42, color: t.base, background: t.accent, padding: "18px 44px", borderRadius: 999, transform: `scale(${teaseIn}) rotate(${wobble}deg)` }}>
        {data.tease ?? "wait for #3 🤯"}
      </div>
      {t.grain && <Grain />}
    </AbsoluteFill>
  );
};

// ---------- Scene 2: Head-to-head (diagonal or horizontal) ----------
const SceneVersus: React.FC<{ data: MatchData }> = ({ data }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = getTheme(data);
  const v = getVariant(data);
  const slideA = spring({ frame, fps, config: { damping: 200 } });
  const slideB = spring({ frame: frame - 8, fps, config: { damping: 200 } });
  const vsPunch = spring({ frame: frame - 14, fps, config: { damping: 8, mass: 0.7 } });
  const diag = v.vs === "diagonal";

  const clip = (top: boolean) => diag
    ? (top ? "polygon(0 0, 100% 0, 100% 38%, 0 62%)" : "polygon(0 62%, 100% 38%, 100% 100%, 0 100%)")
    : (top ? "polygon(0 0, 100% 0, 100% 47%, 0 53%)" : "polygon(0 53%, 100% 47%, 100% 100%, 0 100%)");

  // Flex-stacked layout: flag, name, and stats are siblings in a column,
  // so longer text PUSHES neighbours instead of overlapping them.
  const half = (team: Team, top: boolean, slide: number) => {
    // auto-scale the name so long names ("BOSNIA AND HERZEGOVINA") shrink instead of wrapping badly
    const nameSize = Math.max(56, Math.min(100, Math.floor(1350 / team.name.length)));
    const colWidth = diag ? 620 : 860;
    return (
      <div
        style={{
          position: "absolute", inset: 0, clipPath: clip(top),
          background: `linear-gradient(${top ? 160 : 340}deg, ${team.color}${data.mode === "throwback" ? "88" : "cc"}, ${t.base})`,
          transform: diag
            ? `translateX(${(top ? -1 : 1) * (1 - slide) * 1080}px)`
            : `translateY(${(top ? -1 : 1) * (1 - slide) * 960}px)`,
          filter: data.mode === "throwback" ? "saturate(0.7) sepia(0.25)" : undefined,
        }}
      >
        <div
          style={{
            position: "absolute",
            display: "flex",
            flexDirection: top ? "column" : "column-reverse",
            gap: 26,
            width: colWidth,
            ...(top
              ? { top: diag ? 140 : 110, left: 80, alignItems: "flex-start", textAlign: "left" as const }
              : { bottom: diag ? 140 : 110, right: 80, alignItems: "flex-end", textAlign: "right" as const }),
          }}
        >
          <Img
            src={flagUrl(team.code)}
            style={{ width: diag ? 380 : 340, borderRadius: 14, boxShadow: "0 30px 80px rgba(0,0,0,0.5)" }}
          />
          <div style={{ fontFamily: DISPLAY, color: t.text, fontSize: nameSize, lineHeight: 1.02, whiteSpace: "nowrap" }}>
            {team.name.toUpperCase()}
          </div>
          <div style={{ fontFamily: BODY, fontWeight: 600, color: t.text, fontSize: 33, lineHeight: 1.65, maxWidth: colWidth }}>
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
      </div>
    );
  };

  return (
    <AbsoluteFill style={{ backgroundColor: t.base }}>
      {half(data.teamA, true, slideA)}
      {half(data.teamB, false, slideB)}
      <div style={{ position: "absolute", top: "50%", left: "50%", transform: `translate(-50%, -50%) rotate(${diag ? -8 : 0}deg) scale(${0.5 + vsPunch * 0.6})`, fontFamily: DISPLAY, fontSize: data.mode === "throwback" ? 125 : diag ? 190 : 160, color: t.accent, textShadow: "0 10px 40px rgba(0,0,0,0.6)", whiteSpace: "nowrap" }}>
        {data.mode === "throwback" ? data.scoreline ?? "VS" : "VS"}
      </div>
      {t.grain && <Grain />}
    </AbsoluteFill>
  );
};

// ---------- Scene 3a: Fact (card or full-bleed poster) ----------
const Flash: React.FC<{ at?: number }> = ({ at = 0 }) => {
  const frame = useCurrentFrame();
  const o = interpolate(frame - at, [0, 4], [0.55, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return o > 0 ? <AbsoluteFill style={{ background: "#fff", opacity: o, zIndex: 40 }} /> : null;
};

const FactCard: React.FC<{ data: MatchData; fact: string; index: number }> = ({ data, fact, index }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = getTheme(data);
  const v = getVariant(data);
  const rise = spring({ frame, fps, config: { damping: 200 } });
  const isFinale = index === 2;
  const shake = isFinale ? Math.sin(frame / 1.6) * interpolate(frame, [0, 10, 25], [4, 4, 0], { extrapolateRight: "clamp" }) : 0;
  const badge = spring({ frame: frame - 4, fps, config: { damping: 8, mass: 0.6 } });
  const accent = isFinale ? t.accent : index % 2 === 0 ? data.teamA.color : data.teamB.color;
  const poster = v.fact === "poster" && !isFinale; // finale always gets the boxed hype treatment

  return (
    <AbsoluteFill style={{ background: t.bg, justifyContent: "center", alignItems: "center" }}>
      <BgClip data={data} />
      <Drift out={index % 2 === 1}><PitchFrame line={t.line} /></Drift>
      <div style={{ fontFamily: DISPLAY, fontSize: 120, color: t.base, background: accent, width: 170, height: 170, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", transform: `scale(${badge}) rotate(${-8 + badge * 8}deg)`, marginBottom: 50, boxShadow: `0 0 ${isFinale ? 90 : 40}px ${accent}66` }}>
        {index + 1}
      </div>
      <div style={{ fontFamily: BODY, fontWeight: 800, color: t.accent, fontSize: 42, letterSpacing: 8, marginBottom: 36, opacity: rise }}>
        {isFinale ? "🤯 THE ONE YOU WAITED FOR" : t.factLabel}
      </div>
      {poster ? (
        <>
          <PopWords text={fact} stagger={2} from={6} style={{ fontFamily: DISPLAY, color: t.text, fontSize: 92, lineHeight: 1.2, textAlign: "center", padding: "0 80px" }} />
          <div style={{ width: 420, height: 14, background: accent, marginTop: 50, transform: `scaleX(${rise})` }} />
        </>
      ) : (
        <div style={{ width: 880, background: "rgba(255,255,255,0.05)", border: `${isFinale ? 5 : 3}px ${data.mode === "throwback" ? "dashed" : "solid"} ${accent}`, borderRadius: t.cardRadius, padding: "60px 56px", transform: `translateY(${(1 - rise) * 300}px) translateX(${shake}px)`, opacity: rise }}>
          <PopWords text={fact} stagger={2} from={6} style={{ fontFamily: DISPLAY, color: t.text, fontSize: isFinale ? 76 : 68, lineHeight: 1.25, textAlign: "center" }} />
        </div>
      )}
      <Flash />
      {t.grain && <Grain />}
    </AbsoluteFill>
  );
};

// ---------- Scene 3b: Countdown quiz (replaces fact #2 on quiz variants) ----------
const QuizCard: React.FC<{ data: MatchData }> = ({ data }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = getTheme(data);
  const q = data.quiz!;
  const qIn = spring({ frame, fps, config: { damping: 200 } });
  // timing inside the 4.5s slot: question 0-1.6s, countdown 1.6-3.1s, answer 3.1-4.5s
  const cdStart = 1.6 * fps, cdEach = 0.5 * fps, ansStart = 3.1 * fps;
  const cdIndex = Math.floor((frame - cdStart) / cdEach); // 0,1,2 -> 3,2,1
  const showCd = frame >= cdStart && frame < ansStart;
  const cdNum = 3 - Math.min(2, Math.max(0, cdIndex));
  const cdPop = spring({ frame: (frame - cdStart) % cdEach, fps, config: { damping: 7, mass: 0.5 } });
  const ansIn = spring({ frame: frame - ansStart, fps, config: { damping: 9, mass: 0.6 } });

  return (
    <AbsoluteFill style={{ background: t.bg, justifyContent: "center", alignItems: "center" }}>
      <BgClip data={data} />
      <Drift><PitchFrame line={t.line} /></Drift>
      <div style={{ fontFamily: BODY, fontWeight: 800, color: t.accent, fontSize: 44, letterSpacing: 8, marginBottom: 40, opacity: qIn }}>
        ⚡ QUICK QUIZ
      </div>
      <PopWords text={q.question} stagger={2} style={{ fontFamily: DISPLAY, color: t.text, fontSize: 82, lineHeight: 1.2, textAlign: "center", padding: "0 80px" }} />
      <div style={{ height: 280, display: "flex", alignItems: "center", justifyContent: "center", marginTop: 30 }}>
        {showCd && (
          <div style={{ fontFamily: DISPLAY, fontSize: 230, color: t.accent, transform: `scale(${0.5 + cdPop * 0.7})`, textShadow: `0 0 80px ${t.accent}88` }}>
            {cdNum}
          </div>
        )}
        {frame >= ansStart && (
          <div style={{ fontFamily: DISPLAY, fontSize: 72, color: t.base, background: t.accent, padding: "30px 50px", borderRadius: t.cardRadius, transform: `scale(${ansIn}) rotate(${(1 - ansIn) * -6}deg)`, textAlign: "center", maxWidth: 880, lineHeight: 1.2 }}>
            {q.answer}
          </div>
        )}
      </div>
      <Flash at={ansStart} />
      {t.grain && <Grain />}
    </AbsoluteFill>
  );
};

// ---------- Scene 4: Outro ----------
const SceneOutro: React.FC<{ data: MatchData }> = ({ data }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = getTheme(data);
  const inA = spring({ frame, fps, config: { damping: 200 } });
  const pulse = 1 + Math.sin(frame / 7) * 0.04;
  const arrowY = Math.abs(Math.sin(frame / 9)) * 26;

  return (
    <AbsoluteFill style={{ background: t.bg, justifyContent: "center", alignItems: "center" }}>
      <BgClip data={data} />
      <Drift out><PitchFrame line={t.line} /></Drift>
      <div style={{ display: "flex", gap: 40, opacity: inA, filter: data.mode === "throwback" ? "saturate(0.7) sepia(0.25)" : undefined }}>
        <Img src={flagUrl(data.teamA.code)} style={{ width: 270, borderRadius: 12 }} />
        <Img src={flagUrl(data.teamB.code)} style={{ width: 270, borderRadius: 12 }} />
      </div>
      <PopWords text={data.question.toUpperCase()} style={{ fontFamily: DISPLAY, color: t.text, fontSize: 96, textAlign: "center", margin: "60px 80px 0", lineHeight: 1.15 }} />
      <div style={{ fontFamily: BODY, fontWeight: 800, color: t.accent, fontSize: 46, marginTop: 46, opacity: inA }}>
        score predictions in the comments
      </div>
      <div style={{ fontSize: 80, transform: `translateY(${arrowY}px)`, marginTop: 8 }}>⬇️</div>
      <div style={{ fontFamily: BODY, fontWeight: 800, color: t.base, background: t.accent, fontSize: 42, padding: "24px 56px", borderRadius: 999, marginTop: 30, transform: `scale(${pulse})` }}>
        + follow — new one every match day
      </div>
      {t.grain && <Grain />}
    </AbsoluteFill>
  );
};

// ---------- Main ----------
export const MatchFactsVideo: React.FC<MatchData> = (data) => {
  const { fps } = useVideoConfig();
  const s = (sec: number) => Math.round(sec * fps);
  const t = getTheme(data);
  const v = getVariant(data);
  const useQuiz = v.quiz && !!data.quiz;

  return (
    <AbsoluteFill style={{ backgroundColor: t.base }}>
      {data.music && <Audio src={staticFile("music.mp3")} volume={0.5} />}
      <ProgressBar accent={t.accent} />
      <Sequence durationInFrames={s(T_HOOK)}><SceneHook data={data} /></Sequence>
      <Sequence from={s(T_HOOK)} durationInFrames={s(T_VS - T_HOOK)}><SceneVersus data={data} /></Sequence>
      {data.facts.slice(0, 3).map((fact, i) => (
        <Sequence key={i} from={s(T_VS + i * T_FACT)} durationInFrames={s(T_FACT)}>
          {i === 1 && useQuiz ? <QuizCard data={data} /> : <FactCard data={data} fact={fact} index={i} />}
        </Sequence>
      ))}
      <Sequence from={s(T_OUTRO)} durationInFrames={s(T_END - T_OUTRO)}><SceneOutro data={data} /></Sequence>
    </AbsoluteFill>
  );
};
