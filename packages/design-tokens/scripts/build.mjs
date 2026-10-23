import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const workspaceRoot = path.resolve(packageRoot, "../..");
const sourcePath = path.join(packageRoot, "tokens.json");
const cssPath = path.join(workspaceRoot, "apps/web/src/styles/tokens.css");
const tsPath = path.join(packageRoot, "src/generated.ts");
const checkOnly = process.argv.includes("--check");

const tokens = JSON.parse(await readFile(sourcePath, "utf8"));

function kebabCase(value) {
  return value.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
}

function flatten(value, prefix = []) {
  return Object.entries(value).flatMap(([key, entry]) => {
    const currentPath = [...prefix, kebabCase(key)];
    return entry && typeof entry === "object" && !Array.isArray(entry)
      ? flatten(entry, currentPath)
      : [[currentPath.join("-"), entry]];
  });
}

const css = [
  "/* Generated from packages/design-tokens/tokens.json. Do not edit directly. */",
  ":root {",
  ...flatten(Object.fromEntries(Object.entries(tokens).filter(([key]) => key !== "themes"))).map(([name, value]) => {
    const namespace = name.startsWith("color-") || name.startsWith("radius-") ? "--ds-" : "--";
    return `  ${namespace}${name}: ${value};`;
  }),
  "}",
  "",
].join("\n");

const typescript = [
  "/* Generated from tokens.json. Do not edit directly. */",
  `export const tokens = ${JSON.stringify(tokens, null, 2)} as const;`,
  "",
].join("\n");

async function syncFile(filePath, contents) {
  if (checkOnly) {
    let existing;
    try {
      existing = await readFile(filePath, "utf8");
    } catch {
      throw new Error(`Generated token file is missing: ${path.relative(workspaceRoot, filePath)}. Run pnpm tokens:build.`);
    }
    if (existing !== contents) {
      throw new Error(`Generated token file is out of date: ${path.relative(workspaceRoot, filePath)}. Run pnpm tokens:build.`);
    }
    return;
  }

  await writeFile(filePath, contents);
}

await Promise.all([syncFile(cssPath, css), syncFile(tsPath, typescript)]);
console.log(checkOnly ? "Design tokens are up to date." : "Generated web and TypeScript design tokens.");
