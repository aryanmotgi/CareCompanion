import React from "react";
import { AbsoluteFill, Audio, interpolate, staticFile, useCurrentFrame } from "remotion";
import { TransitionSeries, linearTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { TitleCard } from "../compositions/00-TitleCard";
import { Hook } from "../compositions/01-Hook";
import { HomeScreen } from "../compositions/02-HomeScreen";
import { CareTab } from "../compositions/03-CareTab";
import { TreatmentJourney } from "../compositions/04-TreatmentJourney";
import { AICompanion } from "../compositions/05-AICompanion";
import { ScanHealth } from "../compositions/06-ScanHealth";
import { CredibilityStack } from "../compositions/07-CredibilityStack";
import { EmergencyCard } from "../compositions/08-EmergencyCard";
import { Closing } from "../compositions/09-Closing";
import { Watermark } from "../components/Watermark";
import { ProgressDots } from "../components/ProgressDots";

const TOTAL_FRAMES = 4650;
const FADE = fade();
const TIMING = linearTiming({ durationInFrames: 30 });

// 🎵 MUSIC: drop a music.mp3 into public/ to enable.
// To remove music, delete the <MusicTrack /> line below.
const MusicTrack: React.FC = () => {
  const frame = useCurrentFrame();
  const volume = interpolate(
    frame,
    [0, 60, TOTAL_FRAMES - 90, TOTAL_FRAMES],
    [0, 0.18, 0.18, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );
  return <Audio src={staticFile("music.mp3")} volume={volume} />;
};

export const FullVideo: React.FC = () => {
  return (
    <AbsoluteFill>
      {/* <MusicTrack /> */}{/* Uncomment after dropping music.mp3 into public/ */}
      <TransitionSeries>
        <TransitionSeries.Sequence durationInFrames={150}>
          <TitleCard />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={FADE} timing={TIMING} />
        <TransitionSeries.Sequence durationInFrames={660}>
          <Hook />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={FADE} timing={TIMING} />
        <TransitionSeries.Sequence durationInFrames={600}>
          <HomeScreen />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={FADE} timing={TIMING} />
        <TransitionSeries.Sequence durationInFrames={660}>
          <CareTab />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={FADE} timing={TIMING} />
        <TransitionSeries.Sequence durationInFrames={600}>
          <TreatmentJourney />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={FADE} timing={TIMING} />
        <TransitionSeries.Sequence durationInFrames={540}>
          <AICompanion />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={FADE} timing={TIMING} />
        <TransitionSeries.Sequence durationInFrames={540}>
          <ScanHealth />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={FADE} timing={TIMING} />
        <TransitionSeries.Sequence durationInFrames={450}>
          <CredibilityStack />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={FADE} timing={TIMING} />
        <TransitionSeries.Sequence durationInFrames={360}>
          <EmergencyCard />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={FADE} timing={TIMING} />
        <TransitionSeries.Sequence durationInFrames={360}>
          <Closing />
        </TransitionSeries.Sequence>
      </TransitionSeries>
      <Watermark />
      <ProgressDots />
    </AbsoluteFill>
  );
};
