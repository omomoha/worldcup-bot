import { Composition } from "remotion";
import { MatchFactsVideo, MatchData } from "./MatchFactsVideo";
import matches from "../data/matches.json";

const FPS = 30;
const DURATION_SECONDS = 28;

export const RemotionRoot: React.FC = () => {
  return (
    <>
      {(matches as MatchData[]).map((m, i) => (
        <Composition
          key={i}
          id={`Match${i}`}
          component={MatchFactsVideo}
          durationInFrames={FPS * DURATION_SECONDS}
          fps={FPS}
          width={1080}
          height={1920}
          defaultProps={m}
        />
      ))}
    </>
  );
};
