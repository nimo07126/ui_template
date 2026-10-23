import { ColorEditor } from "./components/color-editor";
import { ColorMatrix } from "./components/color-matrix";
import { ColorWorkbenchProvider } from "./components/color-workbench-context";
import { ColorsIntro } from "./components/colors-intro";
import { ThemeGallery } from "./components/theme-gallery";
import { ThemeSaveBar } from "./components/theme-save-bar";

export default function ColorsPage() {
  return (
    <ColorWorkbenchProvider>
      <section
        className="[--matrix-line:color-mix(in_oklab,_var(--border)_36%,_transparent)] [--matrix-outline:color-mix(in_oklab,_var(--border)_52%,_transparent)] w-full min-w-0"
        aria-labelledby="colors-title"
      >
        <ColorsIntro />
        <ThemeGallery />
        <ThemeSaveBar />
        <ColorMatrix />
        <ColorEditor />
      </section>
    </ColorWorkbenchProvider>
  );
}
