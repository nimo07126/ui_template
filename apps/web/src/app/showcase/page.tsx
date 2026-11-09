import type { Metadata } from "next";
import { ShowcaseProvider } from "./components/showcase-context";
import { ShowcaseFooter } from "./components/showcase-footer";
import { ShowcaseGroups } from "./components/showcase-groups";
import { ShowcaseIntro } from "./components/showcase-intro";
import { ShowcaseToolbar } from "./components/showcase-toolbar";

export const metadata: Metadata = {
  title: "组件预览 · 澄序",
  description: "121 个免费 Arc UI 组件与澄序保留的基础组件，共用四套澄序主题。",
};

export default function ShowcasePage() {
  return (
    <ShowcaseProvider>
      <section
        aria-labelledby="components-title"
        className="grid min-w-0 gap-8 max-[40rem]:gap-6"
      >
        <ShowcaseIntro />
        <ShowcaseToolbar />
        <ShowcaseGroups />
        <ShowcaseFooter />
      </section>
    </ShowcaseProvider>
  );
}
