import { Composition } from "remotion";
import { MatchFactsVideo, MatchData } from "./MatchFactsVideo";
import todayData from "../data/today.json";

const FPS = 30;
const DURATION_SECONDS = 28;

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="MatchFacts"
      component={MatchFactsVideo}
      durationInFrames={FPS * DURATION_SECONDS}
      fps={FPS}
      width={1080}
      height={1920}
      defaultProps={todayData as MatchData}
    />
  );
};
