import React from "react";
import {
  AbsoluteFill,
  Img,
  Sequence,
  interpolate,
  spring,
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
  code: string; // ISO 3166-1 alpha-2, lowercase (for flagcdn)
  color: string; // team primary color, used for theming
  capital: string;
  population: string; // pre-formatted, e.g. "214M"
  worldCupTitles: number;
};

export type MatchData = {
  date: string; // "11 June 2026"
  kickoff: string; // "18:00 GMT"
  venue: string;
  teamA: Team;
  teamB: Team;
  hook: string; // one-line hook
  facts: string[]; // exactly 3
  question: string; // engagement question for the outro
};

// ---------- Design tokens ----------
const PITCH = "#0A2E20";
const PITCH_DEEP = "#051A11";
const CHALK = "#F7F4EC";
const GOLD = "#E8B83A";

const flagUrl = (code: string) => `https://flagcdn.com/w640/${code}.png`;

const bgStyle: React.CSSProperties = {
  background: `radial-gradient(120% 80% at 50% 0%, ${PITCH} 0%, ${PITCH_DEEP} 75%)`,
};

// Chalk pitch line that frames every scene
const PitchFrame: React.FC = () => (
  <AbsoluteFill style={{ padding: 48 }}>
    <div
      style={{
        width: "100%",
        height: "100%",
        border: `4px solid rgba(247,244,236,0.18)`,
        borderRadius: 8,
      }}
    />
    {/* centre circle, cut by frame edge */}
    <div
      style={{
        position: "absolute",
        left: "50%",
        bottom: -260,
        transform: "translateX(-50%)",
        width: 620,
        height: 620,
        border: `4px solid rgba(247,244,236,0.12)`,
        borderRadius: "50%",
      }}
    />
  </AbsoluteFill>
);

// ---------- Scene 1: Hook ----------
const SceneHook: React.FC<{ data: MatchData }> = ({ data }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const punch = spring({ frame, fps, config: { damping: 12, mass: 0.6 } });
  const sub = spring({ frame: frame - 12, fps, config: { damping: 200 } });

  return (
    <AbsoluteFill style={{ ...bgStyle, justifyContent: "center", alignItems: "center" }}>
      <PitchFrame />
      <div
        style={{
          fontFamily: BODY,
          color: GOLD,
          fontSize: 44,
          fontWeight: 700,
          letterSpacing: 14,
          opacity: sub,
        }}
      >
        MATCH DAY · {data.date.toUpperCase()}
      </div>
      <div
        style={{
          fontFamily: DISPLAY,
          color: CHALK,
          fontSize: 160,
          lineHeight: 1.02,
          textAlign: "center",
          transform: `scale(${0.7 + punch * 0.3})`,
          margin: "30px 60px 0",
        }}
      >
        {data.teamA.name.toUpperCase()}
        <span style={{ color: GOLD, display: "block", fontSize: 90 }}>VS</span>
        {data.teamB.name.toUpperCase()}
      </div>
      <div
        style={{
          fontFamily: BODY,
          color: CHALK,
          fontSize: 40,
          marginTop: 50,
          opacity: sub,
        }}
      >
        {data.kickoff} · {data.venue}
      </div>
    </AbsoluteFill>
  );
};

// ---------- Scene 2: Diagonal head-to-head ----------
const SceneVersus: React.FC<{ data: MatchData }> = ({ data }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const slideA = spring({ frame, fps, config: { damping: 200 } });
  const slideB = spring({ frame: frame - 8, fps, config: { damping: 200 } });

  const half = (team: Team, top: boolean, slide: number) => (
    <div
      style={{
        position: "absolute",
        inset: 0,
        clipPath: top
          ? "polygon(0 0, 100% 0, 100% 38%, 0 62%)"
          : "polygon(0 62%, 100% 38%, 100% 100%, 0 100%)",
        background: `linear-gradient(${top ? 160 : 340}deg, ${team.color}cc, ${PITCH_DEEP})`,
        transform: `translateX(${(top ? -1 : 1) * (1 - slide) * 1080}px)`,
      }}
    >
      <Img
        src={flagUrl(team.code)}
        style={{
          position: "absolute",
          width: 560,
          borderRadius: 16,
          boxShadow: "0 30px 80px rgba(0,0,0,0.5)",
          ...(top
            ? { top: 200, left: 80 }
            : { bottom: 200, right: 80 }),
        }}
      />
      <div
        style={{
          position: "absolute",
          fontFamily: DISPLAY,
          color: CHALK,
          fontSize: 110,
          ...(top ? { top: 560, left: 84 } : { bottom: 560, right: 84, textAlign: "right" }),
        }}
      >
        {team.name.toUpperCase()}
      </div>
      <div
        style={{
          position: "absolute",
          fontFamily: BODY,
          color: CHALK,
          fontSize: 38,
          lineHeight: 1.6,
          opacity: 0.9,
          ...(top ? { top: 700, left: 88 } : { bottom: 700, right: 88, textAlign: "right" }),
        }}
      >
        Capital: {team.capital}
        <br />
        Population: {team.population}
        <br />
        World Cup titles: {team.worldCupTitles} {"★".repeat(Math.min(team.worldCupTitles, 5))}
      </div>
    </div>
  );

  return (
    <AbsoluteFill style={bgStyle}>
      {half(data.teamA, true, slideA)}
      {half(data.teamB, false, slideB)}
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: `translate(-50%, -50%) rotate(-8deg) scale(${slideB})`,
          fontFamily: DISPLAY,
          fontSize: 200,
          color: GOLD,
          textShadow: "0 10px 40px rgba(0,0,0,0.6)",
        }}
      >
        VS
      </div>
    </AbsoluteFill>
  );
};

// ---------- Scene 3: Fact cards ----------
const FactCard: React.FC<{ fact: string; index: number; accent: string }> = ({
  fact,
  index,
  accent,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const rise = spring({ frame, fps, config: { damping: 200 } });

  return (
    <AbsoluteFill style={{ ...bgStyle, justifyContent: "center", alignItems: "center" }}>
      <PitchFrame />
      <div
        style={{
          fontFamily: BODY,
          fontWeight: 800,
          color: GOLD,
          fontSize: 46,
          letterSpacing: 10,
          marginBottom: 40,
          opacity: rise,
        }}
      >
        DID YOU KNOW? · {index + 1}/3
      </div>
      <div
        style={{
          width: 880,
          background: "rgba(247,244,236,0.06)",
          border: `3px solid ${accent}`,
          borderRadius: 24,
          padding: "70px 60px",
          transform: `translateY(${(1 - rise) * 300}px)`,
          opacity: rise,
        }}
      >
        <div
          style={{
            fontFamily: DISPLAY,
            color: CHALK,
            fontSize: 72,
            lineHeight: 1.25,
            textAlign: "center",
          }}
        >
          {fact}
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ---------- Scene 4: Outro / CTA ----------
const SceneOutro: React.FC<{ data: MatchData }> = ({ data }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const inA = spring({ frame, fps, config: { damping: 200 } });
  const pulse = 1 + Math.sin(frame / 8) * 0.03;

  return (
    <AbsoluteFill style={{ ...bgStyle, justifyContent: "center", alignItems: "center" }}>
      <PitchFrame />
      <div style={{ display: "flex", gap: 40, opacity: inA }}>
        <Img src={flagUrl(data.teamA.code)} style={{ width: 300, borderRadius: 12 }} />
        <Img src={flagUrl(data.teamB.code)} style={{ width: 300, borderRadius: 12 }} />
      </div>
      <div
        style={{
          fontFamily: DISPLAY,
          color: CHALK,
          fontSize: 96,
          textAlign: "center",
          margin: "70px 80px 0",
          lineHeight: 1.15,
          opacity: inA,
        }}
      >
        {data.question.toUpperCase()}
      </div>
      <div
        style={{
          fontFamily: BODY,
          fontWeight: 700,
          color: PITCH_DEEP,
          background: GOLD,
          fontSize: 44,
          padding: "26px 60px",
          borderRadius: 999,
          marginTop: 80,
          transform: `scale(${pulse})`,
        }}
      >
        Drop your prediction ⬇ + follow for daily facts
      </div>
    </AbsoluteFill>
  );
};

// ---------- Main composition ----------
export const MatchFactsVideo: React.FC<MatchData> = (data) => {
  const { fps } = useVideoConfig();
  const s = (sec: number) => Math.round(sec * fps);

  return (
    <AbsoluteFill style={{ backgroundColor: PITCH_DEEP }}>
      <Sequence durationInFrames={s(3.5)}>
        <SceneHook data={data} />
      </Sequence>
      <Sequence from={s(3.5)} durationInFrames={s(6.5)}>
        <SceneVersus data={data} />
      </Sequence>
      {data.facts.slice(0, 3).map((fact, i) => (
        <Sequence key={i} from={s(10 + i * 4.5)} durationInFrames={s(4.5)}>
          <FactCard
            fact={fact}
            index={i}
            accent={i % 2 === 0 ? data.teamA.color : data.teamB.color}
          />
        </Sequence>
      ))}
      <Sequence from={s(23.5)} durationInFrames={s(4.5)}>
        <SceneOutro data={data} />
      </Sequence>
    </AbsoluteFill>
  );
};
