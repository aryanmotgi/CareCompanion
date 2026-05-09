import React from "react";
import { Composition } from "remotion";
import { TitleCard } from "./compositions/00-TitleCard";
import { Hook } from "./compositions/01-Hook";
import { HomeScreen } from "./compositions/02-HomeScreen";
import { CareTab } from "./compositions/03-CareTab";
import { TreatmentJourney } from "./compositions/04-TreatmentJourney";
import { AICompanion } from "./compositions/05-AICompanion";
import { ScanHealth } from "./compositions/06-ScanHealth";
import { CredibilityStack } from "./compositions/07-CredibilityStack";
import { EmergencyCard } from "./compositions/08-EmergencyCard";
import { Closing } from "./compositions/09-Closing";
import { Onboarding } from "./compositions/10-Onboarding";
import { HealthKit } from "./compositions/11-HealthKit";
import { TechStack } from "./compositions/12-TechStack";
import { Website } from "./compositions/13-Website";
import { Closing2 } from "./compositions/14-Closing2";
import { FullVideo } from "./sequences/FullVideo";
import { FullVideo2 } from "./sequences/FullVideo2";

const VIDEO_CONFIG = { fps: 30, width: 1920, height: 1080 } as const;

export const Root: React.FC = () => {
  return (
    <>
      {/* === VIDEO 1: Main Demo (~2:35) === */}
      <Composition id="FullVideo" component={FullVideo} durationInFrames={4650} {...VIDEO_CONFIG} />
      <Composition id="TitleCard" component={TitleCard} durationInFrames={150} {...VIDEO_CONFIG} />
      <Composition id="Hook" component={Hook} durationInFrames={660} {...VIDEO_CONFIG} />
      <Composition id="HomeScreen" component={HomeScreen} durationInFrames={600} {...VIDEO_CONFIG} />
      <Composition id="CareTab" component={CareTab} durationInFrames={660} {...VIDEO_CONFIG} />
      <Composition id="TreatmentJourney" component={TreatmentJourney} durationInFrames={600} {...VIDEO_CONFIG} />
      <Composition id="AICompanion" component={AICompanion} durationInFrames={540} {...VIDEO_CONFIG} />
      <Composition id="ScanHealth" component={ScanHealth} durationInFrames={540} {...VIDEO_CONFIG} />
      <Composition id="CredibilityStack" component={CredibilityStack} durationInFrames={450} {...VIDEO_CONFIG} />
      <Composition id="EmergencyCard" component={EmergencyCard} durationInFrames={360} {...VIDEO_CONFIG} />
      <Composition id="Closing" component={Closing} durationInFrames={360} {...VIDEO_CONFIG} />

      {/* === VIDEO 2: Technical Deep-Dive (~50s) === */}
      <Composition id="FullVideo2" component={FullVideo2} durationInFrames={1500} {...VIDEO_CONFIG} />
      <Composition id="Onboarding" component={Onboarding} durationInFrames={330} {...VIDEO_CONFIG} />
      <Composition id="HealthKit" component={HealthKit} durationInFrames={390} {...VIDEO_CONFIG} />
      <Composition id="TechStack" component={TechStack} durationInFrames={270} {...VIDEO_CONFIG} />
      <Composition id="Website" component={Website} durationInFrames={390} {...VIDEO_CONFIG} />
      <Composition id="Closing2" component={Closing2} durationInFrames={240} {...VIDEO_CONFIG} />
    </>
  );
};
