import { SectionShared } from "@/shared/layout/section-shared";
import { TypographyAdvice } from "./components/typography-advice";
import { TypographyFoundation } from "./components/typography-foundation";
import { TypographyIntro } from "./components/typography-intro";
import { TypographySpecimens } from "./components/typography-specimens";

export default function TypographyPage() {
  return (
    <SectionShared id="typography" aria-labelledby="typography-title">
      <TypographyIntro />
      <TypographyFoundation />
      <TypographySpecimens />
      <TypographyAdvice />
    </SectionShared>
  );
}
