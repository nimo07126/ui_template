"use client";

import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent, ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Check, CircleAlert } from "lucide-react";
import { Button } from "../../button/button";
import { CopyButton } from "../../copy-button/copy-button";
import { motionTokens } from "../../lib/motion-tokens";
import { installSnippetFrameworks, installSnippetPackageManagers } from "./install-snippet-data";
import type { InstallSnippetFramework, InstallSnippetPackageManager } from "./install-snippet-data";
import { InstallSnippetMark, hasInstallSnippetMark } from "./install-snippet-marks";
import styles from "./install-snippet.module.css";

export type { InstallSnippetFile, InstallSnippetFramework, InstallSnippetPackageManager } from "./install-snippet-data";
export { installSnippetFrameworks, installSnippetPackageManagers } from "./install-snippet-data";

export type InstallSnippetStep = "install" | "key" | "code";

export interface InstallSnippetProps {
  /** Card title. */
  title?: ReactNode;
  /** One line under the title. */
  description?: ReactNode;
  /** Small muted label at the top right, for example the SDK version. Pass null to hide it. */
  version?: ReactNode;
  /** Framework tabs and their snippets. Snippets use `{{key}}` where the API key goes. */
  frameworks?: InstallSnippetFramework[];
  /** Controlled framework id. */
  framework?: string;
  defaultFramework?: string;
  onFrameworkChange?: (id: string) => void;
  /** Controlled package manager. */
  packageManager?: InstallSnippetPackageManager;
  defaultPackageManager?: InstallSnippetPackageManager;
  onPackageManagerChange?: (id: InstallSnippetPackageManager) => void;
  /** Controlled API key. When set, the snippets show it instead of the placeholder. */
  apiKey?: string;
  /** Shown in place of the key until one exists. */
  keyPlaceholder?: string;
  /** Creates a key. Defaults to a simulated generator; nothing leaves the browser. Reject to show the error state. */
  generateKey?: (signal: AbortSignal) => Promise<string>;
  onKeyGenerated?: (key: string) => void;
  /** Called after a snippet is copied, with the exact text that went to the clipboard. */
  onCopy?: (step: InstallSnippetStep, value: string) => void;
  className?: string;
}

const KEY = "{{key}}";
const ease = [...motionTokens.ease.standard] as [number, number, number, number];
const show = { duration: .16, ease } as const;
const hide = { duration: .1, ease } as const;
const instant = { duration: 0 } as const;
const slide = { type: "spring", visualDuration: .24, bounce: 0 } as const;
const cx = (...names: (string | false | null | undefined)[]) => names.filter(Boolean).join(" ");

function wait(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const timer = window.setTimeout(resolve, ms);
    signal.addEventListener("abort", () => { window.clearTimeout(timer); reject(new DOMException("Aborted", "AbortError")); }, { once: true });
  });
}

/** Simulated: a random 24 character live key after a short, believable wait. */
async function simulateKey(signal: AbortSignal) {
  await wait(780, signal);
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return `lm_live_${Array.from(bytes, byte => alphabet[byte % alphabet.length]).join("")}`;
}

/* ---------- Highlighting: a small, dependency free tokenizer for shell, env, JS/TS/JSX and HTML lines. ---------- */

type TokenKind = "plain" | "kw" | "str" | "fn" | "tag" | "attr" | "cm" | "punct" | "num" | "key";
type Token = { kind: TokenKind; text: string };
type Lang = "shell" | "env" | "code";

const codePattern = /(\/\/.*$|<!--.*?-->)|("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`)|(=>)|(<\/?[A-Za-z][\w.]*|\/?>)|\b(import|from|export|default|function|return|const|let|var|await|async|new|type|of)\b|([A-Za-z_$][\w$]*)(?=\()|([A-Za-z_][\w-]*)(?==)|(\b\d+\b)|(\{\{key\}\})|([{}()[\];,.:!])/g;
const kinds: TokenKind[] = ["cm", "str", "punct", "tag", "kw", "fn", "attr", "num", "key", "punct"];

function tokenize(line: string, lang: Lang): Token[] {
  let tokens: Token[] = [];
  if (lang === "shell") {
    const [bin, ...rest] = line.split(" ");
    tokens = [{ kind: "fn", text: bin }];
    rest.forEach(word => tokens.push({ kind: "plain", text: " " }, { kind: /[@/]/.test(word) ? "str" : word.startsWith("-") ? "cm" : "plain", text: word }));
  } else if (lang === "env" && line.includes("=") && !line.trimStart().startsWith("#")) {
    const at = line.indexOf("=");
    tokens = [{ kind: "attr", text: line.slice(0, at) }, { kind: "punct", text: "=" }, { kind: "str", text: line.slice(at + 1) }];
  } else {
    let last = 0;
    for (const match of line.matchAll(codePattern)) {
      const index = match.index ?? 0;
      if (index > last) tokens.push({ kind: "plain", text: line.slice(last, index) });
      const group = match.slice(1).findIndex(Boolean);
      tokens.push({ kind: kinds[group] ?? "plain", text: match[0] });
      last = index + match[0].length;
    }
    if (last < line.length) tokens.push({ kind: "plain", text: line.slice(last) });
  }
  /* The key can sit inside a string or an env value: split it out so it renders as its own slot. */
  return tokens.flatMap(token => {
    if (token.kind === "key" || !token.text.includes(KEY)) return [token];
    return token.text.split(KEY).flatMap((part, index) => [...(index ? [{ kind: "key" as const, text: KEY }] : []), ...(part ? [{ kind: token.kind, text: part }] : [])]);
  });
}

function langOf(file: string, shell = false): Lang {
  if (shell) return "shell";
  return /(^|\/)\.env/.test(file) ? "env" : "code";
}

/* ---------- Pieces ---------- */

/** One crossfade: the old content fades out in 100ms while the new one fades in over 160ms and rises 2px. Both share one
 *  grid cell, so the box never resizes mid swap. */
function Swap({ id, children, className, itemClassName }: { id: string; children: ReactNode; className?: string; itemClassName?: string }) {
  const reduced = useReducedMotion() ?? false;
  return <div className={cx(styles.swap, className)}>
    <AnimatePresence initial={false}>
      <motion.div key={id} className={cx(styles.swapItem, itemClassName)}
        initial={reduced ? { opacity: 0 } : { opacity: 0, y: 2 }} animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, transition: reduced ? instant : hide }} transition={reduced ? instant : show}>
        {children}
      </motion.div>
    </AnimatePresence>
  </div>;
}

/** The API key slot. Monospace, so its width is exactly its length in ch: the slot eases from the placeholder's width to
 *  the key's while the key wipes in from the left. A key that is already there when the slot mounts shows at once. */
function KeySlot({ value, placeholder, fresh }: { value?: string; placeholder: string; fresh: boolean }) {
  const reduced = useReducedMotion() ?? false;
  const text = value ?? placeholder;
  return <motion.span className={styles.keySlot} data-filled={value ? "" : undefined} data-fresh={fresh && value ? "" : undefined}
    initial={false} animate={{ width: `${text.length}ch` }} transition={reduced ? instant : slide}>
    <AnimatePresence initial={false}>
      {value
        ? <motion.span key={value} className={styles.keyText}
          initial={fresh && !reduced ? { clipPath: "inset(0 100% 0 0)" } : false} animate={{ clipPath: "inset(0 0% 0 0)" }}
          exit={{ opacity: 0, transition: reduced ? instant : hide }} transition={{ duration: .34, ease: [...motionTokens.ease.enter] }}>{value}</motion.span>
        : <motion.span key="placeholder" className={styles.keyText} exit={{ opacity: 0, transition: reduced ? instant : hide }}>{placeholder}</motion.span>}
    </AnimatePresence>
  </motion.span>;
}

function CodeLines({ code, lang, numbered, keyValue, placeholder, fresh }: { code: string; lang: Lang; numbered: boolean; keyValue?: string; placeholder: string; fresh: boolean }) {
  const lines = useMemo(() => code.split("\n").map(line => tokenize(line, lang)), [code, lang]);
  return <pre className={styles.pre}><code>
    {lines.map((tokens, row) => <span key={row} className={styles.line}>
      {numbered && <span className={styles.ln} aria-hidden="true">{row + 1}</span>}
      {tokens.length ? tokens.map((token, index) => token.kind === "key"
        ? <KeySlot key={index} value={keyValue} placeholder={placeholder} fresh={fresh} />
        : <span key={index} className={token.kind === "plain" ? undefined : styles[token.kind]}>{token.text}</span>) : " "}
    </span>)}
  </code></pre>;
}

type TabItem<T extends string> = { id: T; label: string; mark?: ReactNode };

/** Tabs with a measured highlight that slides on a bounce-free spring. Arrow keys, Home and End move and select. */
function Tabs<T extends string>({ items, value, onChange, label, variant, panelId, idBase }: {
  items: TabItem<T>[]; value: T; onChange: (id: T) => void; label: string; variant: "framework" | "pm"; panelId?: string; idBase: string;
}) {
  const reduced = useReducedMotion() ?? false;
  const listRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef(new Map<string, HTMLButtonElement>());
  const [box, setBox] = useState<{ x: number; w: number } | null>(null);

  useLayoutEffect(() => {
    const measure = () => {
      const node = tabRefs.current.get(value);
      if (node) setBox(prev => prev && prev.x === node.offsetLeft && prev.w === node.offsetWidth ? prev : { x: node.offsetLeft, w: node.offsetWidth });
    };
    measure();
    if (typeof ResizeObserver === "undefined" || !listRef.current) return;
    const observer = new ResizeObserver(measure);
    observer.observe(listRef.current);
    return () => observer.disconnect();
  }, [value, items.length]);

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const index = items.findIndex(item => item.id === value);
    const next = event.key === "ArrowRight" ? (index + 1) % items.length
      : event.key === "ArrowLeft" ? (index - 1 + items.length) % items.length
        : event.key === "Home" ? 0 : event.key === "End" ? items.length - 1 : -1;
    if (next < 0) return;
    event.preventDefault();
    onChange(items[next].id);
    tabRefs.current.get(items[next].id)?.focus();
  }

  return <div ref={listRef} role="tablist" aria-label={label} className={variant === "framework" ? styles.tabs : styles.pmTabs}
    style={variant === "framework" ? { gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` } : undefined} onKeyDown={onKeyDown}>
    {box && <motion.span className={variant === "framework" ? styles.indicator : styles.pmIndicator} aria-hidden="true"
      initial={false} animate={{ x: box.x, width: box.w }} transition={reduced ? instant : slide} />}
    {items.map(item => {
      const selected = item.id === value;
      return <button key={item.id} ref={node => { if (node) tabRefs.current.set(item.id, node); else tabRefs.current.delete(item.id); }}
        id={`${idBase}-${item.id}`} type="button" role="tab" aria-selected={selected} aria-controls={panelId} tabIndex={selected ? 0 : -1}
        aria-label={variant === "pm" ? item.label : undefined}
        className={variant === "framework" ? styles.tab : styles.pmTab} data-selected={selected ? "" : undefined} onClick={() => onChange(item.id)}>
        {item.mark}<span className={variant === "pm" ? styles.pmLabel : styles.tabLabel}>{item.label}</span>
      </button>;
    })}
  </div>;
}

function CodeBlock({ head, copyValue, copyLabel, onCopied, minLines, children }: { head: ReactNode; copyValue: string; copyLabel: string; onCopied: () => void; minLines: number; children: ReactNode }) {
  return <div className={styles.code}>
    <div className={styles.codeHead}>
      <div className={styles.codeHeadMain}>{head}</div>
      <CopyButton value={copyValue} label={copyLabel} iconOnly variant="plain" className={styles.copy} onCopied={onCopied} />
    </div>
    <div className={styles.codeBody} style={{ minHeight: `calc(${minLines} * var(--is-line) + 2 * var(--is-pad-y))` }}>{children}</div>
  </div>;
}

function Step({ n, title, description, descriptionId, done, action, children }: { n: number; title: string; description: ReactNode; descriptionId: string; done: boolean; action?: ReactNode; children: ReactNode }) {
  return <li className={styles.step}>
    <span className={styles.circle} data-done={done ? "" : undefined} aria-hidden="true">
      <Swap id={done ? "done" : "n"} className={styles.circleSwap}>{done ? <Check size={14} strokeWidth={2} /> : n}</Swap>
    </span>
    <div className={styles.stepMain}>
      <div className={styles.stepHead}>
        <div className={styles.stepText}>
          <h4 className={styles.stepTitle}>{title}<span className={styles.srOnly}>{done ? ", done" : ""}</span></h4>
          <Swap id={descriptionId} className={styles.stepDesc} itemClassName={styles.stepDescItem}>{description}</Swap>
        </div>
        {action}
      </div>
      {children}
    </div>
  </li>;
}

/* ---------- Component ---------- */

/** A "get started in 30 seconds" card for SDK onboarding: framework tabs, three numbered steps (install, add your key,
 *  ship), highlighted snippets that crossfade in reserved space, and a key generator that fills the placeholder in place. */
export function InstallSnippet({
  title = "Get started in 30 seconds",
  description = "Three steps to your first event.",
  version = "v2.4.0",
  frameworks = installSnippetFrameworks,
  framework: frameworkProp,
  defaultFramework,
  onFrameworkChange,
  packageManager: packageManagerProp,
  defaultPackageManager = "npm",
  onPackageManagerChange,
  apiKey: apiKeyProp,
  keyPlaceholder = "YOUR_LUMEN_KEY",
  generateKey,
  onKeyGenerated,
  onCopy,
  className,
}: InstallSnippetProps) {
  const uid = useId().replace(/:/g, "");
  const [frameworkState, setFrameworkState] = useState(defaultFramework ?? frameworks[0]?.id ?? "");
  const [pmState, setPmState] = useState<InstallSnippetPackageManager>(defaultPackageManager);
  const [keyState, setKeyState] = useState<string>();
  const [keyStatus, setKeyStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [fresh, setFresh] = useState<string | null>(null);
  const [done, setDone] = useState<Record<InstallSnippetStep, boolean>>({ install: false, key: false, code: false });
  const [announce, setAnnounce] = useState("");
  const controller = useRef<AbortController | null>(null);

  useEffect(() => () => controller.current?.abort(), []);

  const frameworkId = frameworkProp ?? frameworkState;
  const fw = frameworks.find(item => item.id === frameworkId) ?? frameworks[0];
  const pmId = packageManagerProp ?? pmState;
  const pm = installSnippetPackageManagers.find(item => item.id === pmId) ?? installSnippetPackageManagers[0];
  const apiKey = apiKeyProp ?? keyState;
  const keyReady = Boolean(apiKey);
  const simulated = !generateKey;

  const codeLines = useMemo(() => Math.max(1, ...frameworks.map(item => item.code.code.split("\n").length)), [frameworks]);
  const fill = (code: string) => code.split(KEY).join(apiKey ?? keyPlaceholder);

  if (!fw) return null;

  const usesPm = "packages" in fw.install;
  const installCode = "packages" in fw.install ? `${pm.command} ${fw.install.packages}` : fw.install.code;
  const installValue = fill(installCode);
  const keyValue = fill(fw.key.code);
  const codeValue = fill(fw.code.code);

  function selectFramework(id: string) {
    if (id === frameworkId) return;
    if (frameworkProp === undefined) setFrameworkState(id);
    onFrameworkChange?.(id);
    setAnnounce(`Showing ${frameworks.find(item => item.id === id)?.label ?? id} setup`);
  }

  function selectPm(id: InstallSnippetPackageManager) {
    if (id === pmId) return;
    if (packageManagerProp === undefined) setPmState(id);
    onPackageManagerChange?.(id);
  }

  function copied(step: InstallSnippetStep, value: string) {
    setDone(prev => (step === "key" && !keyReady) || prev[step] ? prev : { ...prev, [step]: true });
    onCopy?.(step, value);
  }

  async function generate() {
    controller.current?.abort();
    const next = new AbortController();
    controller.current = next;
    setKeyStatus("loading");
    setAnnounce("Generating a key");
    try {
      const key = await (generateKey ?? simulateKey)(next.signal);
      if (next.signal.aborted) return;
      setKeyState(key);
      setFresh(key);
      setKeyStatus("ready");
      setDone(prev => ({ ...prev, key: true }));
      setAnnounce(simulated ? "Simulated key added to step 2. Nothing was sent." : "Key created and added to step 2.");
      onKeyGenerated?.(key);
      window.setTimeout(() => setFresh(current => current === key ? null : current), 1100);
    } catch (error) {
      if (next.signal.aborted || (error instanceof DOMException && error.name === "AbortError")) return;
      setKeyStatus("error");
      setAnnounce("Could not create a key. Try again.");
    }
  }

  const keyDescription = keyStatus === "error"
    ? { id: "error", node: <span className={styles.descError}><CircleAlert size={14} strokeWidth={1.75} aria-hidden="true" />Could not create a key</span> }
    : keyReady
      ? { id: "ready", node: simulated && !apiKeyProp ? "Simulated, not sent" : "Key created" }
      : { id: "idle", node: "Create a project key" };

  const items = frameworks.map(item => ({ id: item.id, label: item.label, mark: hasInstallSnippetMark(item.id) ? <InstallSnippetMark id={item.id} size={16} /> : undefined }));
  const pmItems = installSnippetPackageManagers.map(item => ({ id: item.id, label: item.label, mark: <InstallSnippetMark id={item.id} size={14} /> }));
  const panelId = `${uid}-panel`;

  return <section className={cx(styles.root, className)} aria-labelledby={`${uid}-title`}>
    <header className={styles.header}>
      <div className={styles.headerText}>
        <h3 id={`${uid}-title`} className={styles.title}>{title}</h3>
        {description && <p className={styles.subtitle}>{description}</p>}
      </div>
      {version != null && <span className={styles.version}>{version}</span>}
    </header>

    <div className={styles.tabsWrap}>
      <Tabs items={items} value={fw.id} onChange={selectFramework} label="Framework" variant="framework" panelId={panelId} idBase={`${uid}-fw`} />
    </div>

    <ol id={panelId} role="tabpanel" aria-labelledby={`${uid}-fw-${fw.id}`} className={styles.steps}>
      <Step n={1} title="Install" description={usesPm ? "Add the SDK to your project" : "Load the script from our CDN"} descriptionId={usesPm ? "pm" : "cdn"} done={done.install}>
        <CodeBlock copyValue={installValue} copyLabel="Copy install command" onCopied={() => copied("install", installValue)} minLines={1}
          head={<Swap id={usesPm ? "pm" : "file"} className={styles.headSwap}>
            {usesPm
              ? <Tabs items={pmItems} value={pm.id} onChange={selectPm} label="Package manager" variant="pm" idBase={`${uid}-pm`} />
              : <span className={styles.file}>{"file" in fw.install ? fw.install.file : ""}</span>}
          </Swap>}>
          <Swap id={`${fw.id}-${usesPm ? pm.id : "cdn"}`} className={styles.layers} itemClassName={styles.layer}>
            <CodeLines code={installCode} lang={langOf("", usesPm)} numbered={false} placeholder={keyPlaceholder} keyValue={apiKey} fresh={false} />
          </Swap>
        </CodeBlock>
      </Step>

      <Step n={2} title="Add your key" description={keyDescription.node} descriptionId={keyDescription.id} done={done.key}
        action={apiKeyProp === undefined ? <Button size="sm" variant={keyStatus === "ready" ? "secondary" : "primary"} loading={keyStatus === "loading"} onClick={() => void generate()} className={styles.generate}>
          {keyStatus === "ready" ? "Regenerate" : keyStatus === "error" ? "Try again" : "Generate key"}
        </Button> : undefined}>
        <CodeBlock copyValue={keyValue} copyLabel="Copy key line" onCopied={() => copied("key", keyValue)} minLines={1}
          head={<Swap id={fw.key.file} className={styles.headSwap}><span className={styles.file}>{fw.key.file}</span></Swap>}>
          <Swap id={fw.id} className={styles.layers} itemClassName={styles.layer}>
            <CodeLines code={fw.key.code} lang={langOf(fw.key.file)} numbered={false} placeholder={keyPlaceholder} keyValue={apiKey} fresh={fresh !== null && fresh === apiKey} />
          </Swap>
        </CodeBlock>
      </Step>

      <Step n={3} title="Ship" description="Deploy and watch events arrive" descriptionId="ship" done={done.code}>
        <CodeBlock copyValue={codeValue} copyLabel="Copy code" onCopied={() => copied("code", codeValue)} minLines={codeLines}
          head={<Swap id={fw.code.file} className={styles.headSwap}><span className={styles.file}>{fw.code.file}</span></Swap>}>
          <Swap id={fw.id} className={styles.layers} itemClassName={styles.layer}>
            <CodeLines code={fw.code.code} lang={langOf(fw.code.file)} numbered placeholder={keyPlaceholder} keyValue={apiKey} fresh={false} />
          </Swap>
        </CodeBlock>
      </Step>
    </ol>
    <span className={styles.srOnly} role="status" aria-live="polite">{announce}</span>
  </section>;
}

export default InstallSnippet;
