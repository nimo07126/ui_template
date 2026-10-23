import { SectionShared } from "@/shared/layout/section-shared";
import { RadiusBoard } from "./components/radius-board";
import { SpacingBoard } from "./components/spacing-board";
import { SpacingIntro } from "./components/spacing-intro";

export default function SpacingPage() {
  return (
    <SectionShared id="spacing" aria-labelledby="spacing-title">
      <SpacingIntro />
      <div className="grid gap-5">
        <SpacingBoard />
        <RadiusBoard />
      </div>
    </SectionShared>
  );
}
