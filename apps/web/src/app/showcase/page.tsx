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
        className="grid min-w-0 gap-8 max-[40rem]:gap-6"
      >
        <ShowcaseIntro />
        <div className="grid min-w-0 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_10rem] xl:gap-x-4 xl:gap-y-8">
          <ShowcaseNavigation />
          <div className="min-w-0 xl:col-start-1 xl:row-start-1">
            <ShowcaseToolbar />
          </div>
          <div className="min-w-0 xl:col-start-1 xl:row-start-2">
            <ShowcaseGroups />
          </div>
        </div>
        <ShowcaseFooter />
      </section>
    </ShowcaseProvider>
  );
}
