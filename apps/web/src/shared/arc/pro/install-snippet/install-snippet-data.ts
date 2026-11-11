/** Sample setup for Lumen, a fictional product analytics SDK. Every snippet marks the API key with `{{key}}`, which the
 *  component replaces with the generated key, or with the placeholder until there is one. */

export type InstallSnippetPackageManager = "npm" | "pnpm" | "yarn" | "bun";

export interface InstallSnippetFile {
  /** File name shown in the code block header, for example ".env.local". */
  file: string;
  /** Source text. Use `{{key}}` where the API key goes. */
  code: string;
}

export interface InstallSnippetFramework {
  /** Stable id. The built-in ids `next`, `react`, `vue` and `html` get their real marks automatically. */
  id: string;
  /** Tab label, for example "Next.js". */
  label: string;
  /** Step 1. Either packages installed with the chosen package manager, or a file to paste (a CDN script tag). */
  install: { packages: string } | InstallSnippetFile;
  /** Step 2: where the key goes. */
  key: InstallSnippetFile;
  /** Step 3: the code that ships. */
  code: InstallSnippetFile;
}

export const installSnippetPackageManagers: { id: InstallSnippetPackageManager; label: string; command: string }[] = [
  { id: "npm", label: "npm", command: "npm install" },
  { id: "pnpm", label: "pnpm", command: "pnpm add" },
  { id: "yarn", label: "yarn", command: "yarn add" },
  { id: "bun", label: "bun", command: "bun add" },
];

export const installSnippetFrameworks: InstallSnippetFramework[] = [
  {
    id: "next",
    label: "Next.js",
    install: { packages: "@lumen/next" },
    key: { file: ".env.local", code: "NEXT_PUBLIC_LUMEN_KEY={{key}}" },
    code: {
      file: "app/layout.tsx",
      code: `import { Lumen } from "@lumen/next";

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}<Lumen /></body>
    </html>
  );
}`,
    },
  },
  {
    id: "react",
    label: "React",
    install: { packages: "@lumen/react" },
    key: { file: ".env", code: "VITE_LUMEN_KEY={{key}}" },
    code: {
      file: "src/main.tsx",
      code: `import { createRoot } from "react-dom/client";
import { LumenProvider } from "@lumen/react";
import App from "./App";

createRoot(document.getElementById("root")!).render(
  <LumenProvider apiKey={import.meta.env.VITE_LUMEN_KEY}>
    <App />
  </LumenProvider>
);`,
    },
  },
  {
    id: "vue",
    label: "Vue",
    install: { packages: "@lumen/vue" },
    key: { file: ".env", code: "VITE_LUMEN_KEY={{key}}" },
    code: {
      file: "src/main.ts",
      code: `import { createApp } from "vue";
import { lumen } from "@lumen/vue";
import App from "./App.vue";

createApp(App)
  .use(lumen, { apiKey: import.meta.env.VITE_LUMEN_KEY })
  .mount("#app");`,
    },
  },
  {
    id: "html",
    label: "HTML",
    install: { file: "index.html", code: `<script src="https://cdn.lumen.dev/v2/lumen.min.js" defer></script>` },
    key: { file: "index.html", code: `<meta name="lumen-key" content="{{key}}" />` },
    code: {
      file: "index.html",
      code: `<script>
  window.addEventListener("load", () => {
    lumen.page();
    document.querySelector("#upgrade").onclick = () =>
      lumen.track("upgrade_clicked", { plan: "pro" });
  });
</script>`,
    },
  },
];
