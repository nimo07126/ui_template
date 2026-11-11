import type { Metadata } from "next";
import { ShowcaseProvider } from "./components/showcase-context";
import { ShowcaseFooter } from "./components/showcase-footer";
import { ShowcaseGroups } from "./components/showcase-groups";
import { ShowcaseIntro } from "./components/showcase-intro";
import { ShowcaseNavigation } from "./components/showcase-navigation";
import { ShowcaseToolbar } from "./components/showcase-toolbar";

export const metadata: Metadata = {
  title: "组件预览 · 澄序",
  description: "预览 Arc UI 基础与 Pro 组件，以及澄序保留的 shadcn/ui 组件，支持切换四套主题。",
};

export default function ShowcasePage() {
  return (
    <ShowcaseProvider>
      <section
        aria-labelledby="components-title"
        className="grid min-w-0 gap-6 md:gap-8"
      >
        <ShowcaseIntro />
        <ShowcaseToolbar />
        <div className="grid min-w-0 items-start gap-7 xl:grid-cols-[minmax(0,1fr)_11rem] xl:gap-x-8">
          <ShowcaseNavigation />
          <div className="grid min-w-0 gap-12 xl:col-start-1 xl:row-start-1">
            <ShowcaseGroups />
            <ShowcaseFooter />
          </div>
        </div>
      </section>
    </ShowcaseProvider>
  );
}
