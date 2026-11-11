"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import type { CSSProperties, FormEvent, KeyboardEvent, ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Check, CircleAlert, CircleCheck, CircleDashed, Copy, Eye, EyeOff, Plus, RefreshCw, ShieldCheck, Trash2 } from "lucide-react";
import { motionTokens } from "../../lib/motion-tokens";
import { Button } from "../../button/button";
import { TextShimmer } from "../../text-shimmer/text-shimmer";
import { Tooltip } from "../../tooltip/tooltip";
import { checkFormat, defaultProviders, maskKey, providerSpecs, relativeTime, sampleKeys, simulatedTest, toMs } from "./provider-keys-data";
import type { KeyTestRequest, KeyTestResult, ProviderId, ProviderKey, ProviderSpec } from "./provider-keys-data";
import styles from "./provider-keys.module.css";
import { writeClipboard } from "../../lib/use-copy-feedback";

export type { KeyTestRequest, KeyTestResult, ProviderId, ProviderKey, ProviderKeyStatus, ProviderSpec } from "./provider-keys-data";
export { providerSpecs, sampleKeys } from "./provider-keys-data";

export interface ProviderKeysProps {
  /** Controlled keys. Pair with onKeysChange. Providers without an entry read "Not set". */
  keys?: ProviderKey[];
  /** Starting keys when uncontrolled. Leave both out to show the sample workspace; pass [] for an empty card. */
  defaultKeys?: ProviderKey[];
  /** Every change: a key added, rotated, removed, restored or retested. */
  onKeysChange?: (keys: ProviderKey[]) => void;
  /** Which providers get a row, in order. Defaults to Anthropic, OpenAI, Google AI, Mistral and xAI. */
  providers?: ProviderId[];
  /** Tests a key against the provider. Gets the pasted key when adding or rotating, no key when retesting a stored one. Leave it out to simulate. */
  testKey?: (request: KeyTestRequest) => Promise<KeyTestResult>;
  /** A new key passed its test. Persist it here; the row already shows it as connected. */
  onSave?: (provider: ProviderId, key: string, mode: "add" | "rotate") => void;
  /** Fires once the undo window closes, so a removal only reaches your server when it sticks. */
  onRemove?: (provider: ProviderId) => void;
  onCopy?: (provider: ProviderId) => void;
  /** How long a revealed key stays visible, in milliseconds. Defaults to 5000. */
  revealDuration?: number;
  /** How long Undo stays after a removal, in milliseconds. Defaults to 5000. */
  undoDuration?: number;
  /** Shows placeholder rows while keys load. */
  loading?: boolean;
  title?: ReactNode;
  description?: ReactNode;
  /** The quiet line under the list. Null hides it. */
  footer?: ReactNode;
  className?: string;
}

type Editing = { provider: ProviderId; mode: "add" | "rotate" };
const ease = [...motionTokens.ease.standard] as [number, number, number, number];
const heightSpring = { type: "spring" as const, visualDuration: .24, bounce: 0 };
/** Wall clock for event handlers. */
const stamp = () => Date.now();
const cx = (...names: (string | false | null | undefined)[]) => names.filter(Boolean).join(" ");
const article = (word: string) => /^[aeiou]/i.test(word) || word === "xAI" ? "an" : "a";

/** Stacks old and new content in one grid cell and crossfades them, so a swap never changes the cell's size. */
function Swap({ id, children, className, reduced }: { id: string; children: ReactNode; className?: string; reduced: boolean }) {
  return <span className={cx(styles.swap, className)}>
    <AnimatePresence initial={false}>
      <motion.span key={id} className={styles.swapItem}
        initial={reduced ? { opacity: 0 } : { opacity: 0, y: 2 }}
        animate={{ opacity: 1, y: 0, transition: { duration: reduced ? .12 : .16, ease } }}
        exit={{ opacity: 0, transition: { duration: .1, ease } }}>{children}</motion.span>
    </AnimatePresence>
  </span>;
}

function IconSwap({ id, children, reduced }: { id: string; children: ReactNode; reduced: boolean }) {
  return <AnimatePresence initial={false}>
    <motion.span key={id} className={styles.iconSlot} aria-hidden="true"
      initial={reduced ? { opacity: 0 } : { opacity: 0, scale: .7 }}
      animate={{ opacity: 1, scale: 1, transition: { duration: .16, ease } }}
      exit={{ opacity: 0, scale: reduced ? 1 : .7, transition: { duration: .1, ease } }}>{children}</motion.span>
  </AnimatePresence>;
}

const Spinner = () => <span className={styles.spinner} aria-hidden="true" />;

/**
 * A settings card for a workspace's AI provider API keys. Each provider row shows its real mark, the masked key, a status
 * and when it was last used, with reveal for a few seconds, copy, rotate and remove with undo. Adding or rotating a key
 * opens an inline form that checks the format as you type, then tests the connection before saving.
 */
export function ProviderKeys({
  keys: keysProp, defaultKeys, onKeysChange, providers = defaultProviders, testKey, onSave, onRemove, onCopy,
  revealDuration = 5000, undoDuration = 5000, loading = false, title = "Provider keys",
  description = "Your own keys, encrypted at rest and only used by this workspace.", footer, className,
}: ProviderKeysProps) {
  const reduced = useReducedMotion() ?? false;
  const rootRef = useRef<HTMLElement>(null);
  const titleId = useId();
  const [own, setOwn] = useState<ProviderKey[]>(() => defaultKeys ?? (keysProp ? [] : sampleKeys()));
  const list = keysProp ?? own;
  const listRef = useRef(list);
  useEffect(() => { listRef.current = list; }, [list]);
  const simulated = !testKey;

  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  const [revealed, setRevealed] = useState<{ provider: ProviderId; token: number } | null>(null);
  const [copied, setCopied] = useState<ProviderId | null>(null);
  const [testing, setTesting] = useState<Partial<Record<ProviderId, boolean>>>({});
  const [removed, setRemoved] = useState<Partial<Record<ProviderId, ProviderKey>>>({});
  const [editing, setEditing] = useState<Editing | null>(null);
  const [notice, setNotice] = useState("");
  const timers = useRef(new Map<string, number>());
  const controllers = useRef(new Map<ProviderId, AbortController>());
  const returnFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const pending = timers.current, running = controllers.current;
    return () => { pending.forEach(id => window.clearTimeout(id)); running.forEach(c => c.abort()); };
  }, []);
  const later = useCallback((name: string, ms: number, run: () => void) => {
    const map = timers.current;
    window.clearTimeout(map.get(name));
    map.set(name, window.setTimeout(() => { map.delete(name); run(); }, ms));
  }, []);
  const stop = useCallback((name: string) => { window.clearTimeout(timers.current.get(name)); timers.current.delete(name); }, []);
  const announce = useCallback((text: string) => setNotice(simulated ? `${text}. Simulated, nothing was sent.` : text), [simulated]);
  const focusLater = useCallback((...selectors: string[]) => requestAnimationFrame(() => {
    for (const selector of selectors) {
      const node = rootRef.current?.querySelector<HTMLElement>(selector);
      if (node && !(node as HTMLButtonElement).disabled) { node.focus({ preventScroll: true }); return; }
    }
  }), []);

  const commit = useCallback((provider: ProviderId, next: ProviderKey | null) => {
    const prev = listRef.current;
    const at = prev.findIndex(item => item.provider === provider);
    const updated = next ? (at < 0 ? [...prev, next] : prev.map((item, i) => i === at ? next : item)) : prev.filter(item => item.provider !== provider);
    listRef.current = updated;
    if (keysProp === undefined) setOwn(updated);
    onKeysChange?.(updated);
  }, [keysProp, onKeysChange]);

  const run = useCallback((request: KeyTestRequest) => (testKey ?? simulatedTest(listRef.current))(request), [testKey]);
  const find = (provider: ProviderId) => list.find(item => item.provider === provider);

  const reveal = (provider: ProviderId) => {
    const name = providerSpecs[provider].name;
    if (revealed?.provider === provider) { stop("reveal"); setRevealed(null); announce(`${name} key hidden`); return; }
    setRevealed({ provider, token: stamp() });
    announce(`${name} key shown for ${Math.round(revealDuration / 1000)} seconds`);
    later("reveal", revealDuration, () => setRevealed(null));
  };

  const copy = (provider: ProviderId) => {
    const key = find(provider)?.value;
    const name = providerSpecs[provider].name;
    if (!key) return;
    const done = () => {
      setCopied(provider); later("copied", 1400, () => setCopied(null));
      setNotice(`${name} key copied to the clipboard`); onCopy?.(provider);
    };
    writeClipboard(key).then(done, () => setNotice(`Could not copy the ${name} key`));
  };

  const retest = async (provider: ProviderId) => {
    const name = providerSpecs[provider].name;
    controllers.current.get(provider)?.abort();
    const controller = new AbortController();
    controllers.current.set(provider, controller);
    setTesting(state => ({ ...state, [provider]: true }));
    announce(`Testing the ${name} key`);
    try {
      const result = await run({ provider, signal: controller.signal });
      const current = listRef.current.find(item => item.provider === provider);
      if (controller.signal.aborted || !current) return;
      if (result.ok) {
        commit(provider, { ...current, status: "connected", error: undefined, checkedAt: stamp(), lastUsedAt: stamp() });
        announce(`${name} connected${result.detail ? `. ${result.detail}` : ""}`);
      } else {
        commit(provider, { ...current, status: "invalid", error: result.error, checkedAt: stamp() });
        announce(`${name} rejected the key: ${result.error}`);
      }
    } catch {
      if (!controller.signal.aborted) announce(`Could not reach ${name}. Try again`);
    } finally {
      if (controllers.current.get(provider) === controller) {
        controllers.current.delete(provider);
        setTesting(state => ({ ...state, [provider]: false }));
      }
    }
  };

  const remove = (provider: ProviderId) => {
    const previous = find(provider);
    if (!previous) return;
    const name = providerSpecs[provider].name;
    controllers.current.get(provider)?.abort();
    setTesting(state => ({ ...state, [provider]: false }));
    if (revealed?.provider === provider) { stop("reveal"); setRevealed(null); }
    if (editing?.provider === provider) setEditing(null);
    commit(provider, null);
    setRemoved(state => ({ ...state, [provider]: previous }));
    announce(`${name} key removed. Undo is available for ${Math.round(undoDuration / 1000)} seconds`);
    focusLater(`[data-undo="${provider}"]`);
    later(`undo:${provider}`, undoDuration, () => {
      const hadFocus = document.activeElement?.getAttribute("data-undo") === provider;
      setRemoved(state => { const next = { ...state }; delete next[provider]; return next; });
      onRemove?.(provider);
      if (hadFocus) focusLater(`[data-add="${provider}"]`);
    });
  };

  const undo = (provider: ProviderId) => {
    const previous = removed[provider];
    if (!previous) return;
    stop(`undo:${provider}`);
    setRemoved(state => { const next = { ...state }; delete next[provider]; return next; });
    commit(provider, previous);
    announce(`${providerSpecs[provider].name} key restored`);
    focusLater(`[data-remove="${provider}"]`);
  };

  const openForm = (provider: ProviderId, mode: Editing["mode"], trigger: HTMLElement | null) => {
    if (editing?.provider === provider && editing.mode === mode) { closeForm(); return; }
    returnFocus.current = trigger;
    if (mode === "add" && removed[provider]) { stop(`undo:${provider}`); setRemoved(state => { const next = { ...state }; delete next[provider]; return next; }); onRemove?.(provider); }
    setEditing({ provider, mode });
  };
  const closeForm = () => {
    setEditing(null);
    const target = returnFocus.current;
    requestAnimationFrame(() => { if (target?.isConnected) target.focus({ preventScroll: true }); });
  };
  const saved = (provider: ProviderId, key: string, mode: Editing["mode"]) => {
    const name = providerSpecs[provider].name;
    const previous = listRef.current.find(item => item.provider === provider);
    commit(provider, { provider, status: "connected", value: key, last4: key.slice(-4), lastUsedAt: null, checkedAt: stamp() });
    if (previous && revealed?.provider === provider) { stop("reveal"); setRevealed(null); }
    onSave?.(provider, key, mode);
    setEditing(null);
    announce(`${name} key ${mode === "rotate" ? "rotated" : "added"} and connected`);
    focusLater(`[data-rotate="${provider}"]`, `[data-status="${provider}"]`);
  };

  const nextUnset = providers.find(p => !find(p) && !removed[p]) ?? providers.find(p => !find(p));
  const footerNode = footer === undefined
    ? <><ShieldCheck aria-hidden="true" /><span>Keys are encrypted with AES-256 and never written to logs.</span></>
    : footer;

  return (
    <section ref={rootRef} className={cx(styles.root, className)} aria-labelledby={titleId} aria-busy={loading || undefined}>
      <header className={styles.header}>
        <div className={styles.heading}>
          <h3 id={titleId} className={styles.title}>{title}</h3>
          {description ? <p className={styles.description}>{description}</p> : null}
        </div>
        <Button variant="secondary" size="sm" className={styles.headerButton} disabled={loading || !nextUnset}
          aria-expanded={editing?.mode === "add" && editing.provider === nextUnset ? true : undefined}
          onClick={event => nextUnset && openForm(nextUnset, "add", event.currentTarget)}>
          <Plus aria-hidden="true" />Add key
        </Button>
      </header>

      <ul className={styles.list} aria-label="API keys by provider">
        {loading
          ? providers.map(provider => <li key={provider} className={cx(styles.row, styles.skeletonRow)} aria-hidden="true">
              <span className={cx(styles.mark, styles.skeletonMark)} />
              <span className={styles.name}><span className={styles.bar} style={{ width: 84 }} /></span>
              <span className={styles.key}><span className={styles.bar} style={{ width: 132 }} /></span>
              <span className={styles.status}><span className={styles.bar} style={{ width: 76 }} /></span>
              <span className={styles.meta}><span className={styles.bar} style={{ width: 92 }} /></span>
              <span className={styles.actions} />
            </li>)
          : providers.map(provider => {
              const spec = providerSpecs[provider];
              const key = find(provider);
              return <Row key={provider} spec={spec} data={key} now={now} reduced={reduced}
                revealed={revealed?.provider === provider ? revealed.token : null} revealDuration={revealDuration}
                copied={copied === provider} testing={!!testing[provider]} undoable={!!removed[provider]}
                editing={editing?.provider === provider ? editing.mode : null}
                onReveal={() => reveal(provider)} onCopy={() => copy(provider)} onTest={() => retest(provider)}
                onRemove={() => remove(provider)} onUndo={() => undo(provider)}
                onOpen={(mode, trigger) => openForm(provider, mode, trigger)}
                form={editing?.provider === provider
                  ? <KeyForm key={editing.mode} spec={spec} mode={editing.mode} data={key} reduced={reduced} test={run}
                      onCancel={closeForm} onSaved={value => saved(provider, value, editing.mode)} />
                  : null} />;
            })}
      </ul>

      {footerNode !== null ? <p className={styles.footer}>{footerNode}</p> : null}
      <span className={styles.srOnly} role="status" aria-live="polite">{notice}</span>
    </section>
  );
}

interface RowProps {
  spec: ProviderSpec;
  data?: ProviderKey;
  now: number;
  reduced: boolean;
  revealed: number | null;
  revealDuration: number;
  copied: boolean;
  testing: boolean;
  undoable: boolean;
  editing: Editing["mode"] | null;
  form: ReactNode;
  onReveal: () => void;
  onCopy: () => void;
  onTest: () => void;
  onRemove: () => void;
  onUndo: () => void;
  onOpen: (mode: Editing["mode"], trigger: HTMLElement) => void;
}

function Row({ spec, data, now, reduced, revealed, revealDuration, copied, testing, undoable, editing, form, onReveal, onCopy, onTest, onRemove, onUndo, onOpen }: RowProps) {
  const status = data?.status ?? "unset";
  const id = spec.id;
  const { prefix, last4 } = data ? maskKey(spec, data) : { prefix: "", last4: "" };
  const lastUsed = toMs(data?.lastUsedAt);
  const checked = toMs(data?.checkedAt);
  const isRevealed = revealed !== null && !!data?.value;

  const view = testing ? "testing" : status;
  const statusBody = {
    testing: <><Spinner /><TextShimmer>Testing</TextShimmer></>,
    connected: <><CircleCheck className={styles.ok} aria-hidden="true" /><span>Connected</span></>,
    invalid: <><CircleAlert className={styles.bad} aria-hidden="true" /><span>Invalid</span></>,
    unset: <><CircleDashed className={styles.idle} aria-hidden="true" /><span>Not set</span></>,
  }[view];
  const statusLabel = { testing: "Testing", connected: "Connected", invalid: "Invalid", unset: "Not set" }[view];

  const meta = status === "connected" ? (lastUsed ? `Used ${relativeTime(lastUsed, now)}` : "Not used yet")
    : status === "invalid" ? (checked ? `Rejected ${relativeTime(checked, now)}` : "Rejected")
    : undoable ? "Removed just now" : "";

  const keyLine = status === "unset"
    ? <span className={styles.hint}>Get one at {spec.console}</span>
    : isRevealed
      ? <span className={cx(styles.mono, styles.revealed)}>{data!.value}</span>
      : <span className={styles.mono}><span className={styles.prefix}>{prefix}</span><span className={styles.dots}>••••</span><span>{last4}</span></span>;
  const keyId = status === "unset" ? "unset" : isRevealed ? "shown" : `mask:${prefix}${last4}`;

  const tip = status === "invalid" && data?.error ? `${data.error}. Test again` : "Test connection";

  return (
    <li className={styles.row} data-state={view} data-editing={editing ? "" : undefined}>
      <spec.Mark className={styles.mark} aria-hidden="true" />
      <span className={styles.name}>{spec.name}</span>
      <span className={styles.key}><Swap id={keyId} reduced={reduced}>{keyLine}</Swap></span>
      <span className={styles.status}>
        {status === "unset"
          ? <span className={styles.statusChip}><Swap id={view} reduced={reduced}><span className={styles.statusInner}>{statusBody}</span></Swap></span>
          : <Tooltip content={tip}>
              <button type="button" className={cx(styles.statusChip, styles.statusButton)} data-status={id}
                aria-label={`${spec.name}: ${statusLabel}. ${tip}`} aria-busy={testing || undefined}
                onClick={() => { if (!testing) onTest(); }}>
                <Swap id={view} reduced={reduced}><span className={styles.statusInner}>{statusBody}</span></Swap>
              </button>
            </Tooltip>}
      </span>
      <span className={styles.meta}><Swap id={meta || "none"} reduced={reduced}><span className={styles.metaText}>{meta}</span></Swap></span>
      <span className={styles.actions}>
        <Swap id={status === "unset" ? (undoable ? "undo" : "add") : "keyed"} reduced={reduced} className={styles.actionSwap}>
          {status === "unset"
            ? undoable
              ? <button type="button" className={styles.pill} data-undo={id} onClick={onUndo} aria-label={`Undo removing the ${spec.name} key`}>Undo</button>
              : <button type="button" className={styles.pill} data-add={id} aria-expanded={editing === "add"}
                  aria-label={`Add ${article(spec.name)} ${spec.name} key`} onClick={event => onOpen("add", event.currentTarget)}>
                  <Plus aria-hidden="true" />Add key
                </button>
            : <span className={styles.iconRow}>
                <Tooltip content={isRevealed ? "Hide key" : `Reveal for ${Math.round(revealDuration / 1000)} seconds`}>
                  <button type="button" className={styles.icon} data-reveal={id} disabled={!data?.value} aria-pressed={isRevealed}
                    aria-label={isRevealed ? `Hide the ${spec.name} key` : `Reveal the ${spec.name} key for ${Math.round(revealDuration / 1000)} seconds`} onClick={onReveal}>
                    <IconSwap id={isRevealed ? "hide" : "show"} reduced={reduced}>{isRevealed ? <EyeOff /> : <Eye />}</IconSwap>
                    {isRevealed && !reduced
                      ? <svg key={revealed} className={styles.countdown} viewBox="0 0 32 32" aria-hidden="true" style={{ "--reveal-ms": `${revealDuration}ms` } as CSSProperties}>
                          <circle cx="16" cy="16" r="15" pathLength={100} />
                        </svg>
                      : null}
                  </button>
                </Tooltip>
                <Tooltip content={copied ? "Copied" : "Copy key"}>
                  <button type="button" className={cx(styles.icon, copied && styles.copied)} disabled={!data?.value} aria-label={`Copy the ${spec.name} key`} onClick={onCopy}>
                    <IconSwap id={copied ? "done" : "copy"} reduced={reduced}>{copied ? <Check /> : <Copy />}</IconSwap>
                  </button>
                </Tooltip>
                <Tooltip content={status === "invalid" ? "Replace key" : "Rotate key"}>
                  <button type="button" className={styles.icon} data-rotate={id} aria-expanded={editing === "rotate"}
                    aria-label={`${status === "invalid" ? "Replace" : "Rotate"} the ${spec.name} key`} onClick={event => onOpen("rotate", event.currentTarget)}>
                    <span className={styles.iconSlot} aria-hidden="true"><RefreshCw /></span>
                  </button>
                </Tooltip>
                <Tooltip content="Remove key">
                  <button type="button" className={cx(styles.icon, styles.danger)} data-remove={id} aria-label={`Remove the ${spec.name} key`} onClick={onRemove}>
                    <span className={styles.iconSlot} aria-hidden="true"><Trash2 /></span>
                  </button>
                </Tooltip>
              </span>}
        </Swap>
      </span>
      <AnimatePresence initial={false}>
        {form ? <motion.div key="form" className={styles.formWrap}
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1, transition: reduced ? { duration: 0 } : { height: heightSpring, opacity: { duration: .16, delay: .04, ease } } }}
          exit={{ height: 0, opacity: 0, transition: reduced ? { duration: 0 } : { height: heightSpring, opacity: { duration: .1, ease } } }}>
          {form}
        </motion.div> : null}
      </AnimatePresence>
    </li>
  );
}

interface KeyFormProps {
  spec: ProviderSpec;
  mode: Editing["mode"];
  data?: ProviderKey;
  reduced: boolean;
  test: (request: KeyTestRequest) => Promise<KeyTestResult>;
  onCancel: () => void;
  onSaved: (key: string) => void;
}

type Phase = "edit" | "testing" | "connected" | "rejected";

function KeyForm({ spec, mode, data, reduced, test, onCancel, onSaved }: KeyFormProps) {
  const inputId = useId();
  const helpId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const controller = useRef<AbortController | null>(null);
  const [value, setValue] = useState("");
  const [touched, setTouched] = useState(false);
  const [phase, setPhase] = useState<Phase>("edit");
  const [result, setResult] = useState("");

  useEffect(() => {
    const frame = requestAnimationFrame(() => inputRef.current?.focus({ preventScroll: true }));
    return () => { cancelAnimationFrame(frame); controller.current?.abort(); };
  }, []);

  const format = checkFormat(spec, value);
  const busy = phase === "testing" || phase === "connected";
  const formatError = phase === "edit" && (format === "error" || (touched && format === "partial") || (touched && format === "empty"));

  const submit = async (event?: FormEvent) => {
    event?.preventDefault();
    if (busy) return;
    if (format !== "valid") { setTouched(true); inputRef.current?.focus(); return; }
    const key = value.trim();
    controller.current?.abort();
    const current = new AbortController();
    controller.current = current;
    setPhase("testing");
    try {
      const outcome = await test({ provider: spec.id, key, signal: current.signal });
      if (current.signal.aborted) return;
      if (outcome.ok) {
        setResult(outcome.detail ?? `${spec.name} answered`);
        setPhase("connected");
        window.setTimeout(() => { if (!current.signal.aborted) onSaved(key); }, 720);
      } else {
        setResult(outcome.error);
        setPhase("rejected");
        requestAnimationFrame(() => inputRef.current?.select());
      }
    } catch (error) {
      if (current.signal.aborted) return;
      setResult(error instanceof Error && error.message ? error.message : `Could not reach ${spec.name}`);
      setPhase("rejected");
    }
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); controller.current?.abort(); onCancel(); }
  };

  const mask = data ? `${maskKey(spec, data).prefix}••••${maskKey(spec, data).last4}` : "";
  const help: { id: string; tone: "muted" | "ok" | "bad"; icon: ReactNode; text: ReactNode } =
    phase === "testing" ? { id: "testing", tone: "muted", icon: <Spinner />, text: <TextShimmer>Testing connection</TextShimmer> }
    : phase === "connected" ? { id: "connected", tone: "ok", icon: <CircleCheck aria-hidden="true" />, text: `Connected · ${result}` }
    : phase === "rejected" ? { id: `rejected:${result}`, tone: "bad", icon: <CircleAlert aria-hidden="true" />, text: `Rejected: ${result}` }
    : formatError ? { id: format === "error" ? "format" : "short", tone: "bad", icon: <CircleAlert aria-hidden="true" />,
        text: format === "empty" ? `Paste ${article(spec.name)} ${spec.name} key first` : format === "error" ? spec.formatHint : `That ${spec.name} key looks incomplete` }
    : format === "valid" ? { id: "valid", tone: "ok", icon: <Check aria-hidden="true" />, text: "Format looks right" }
    : { id: "idle", tone: "muted", icon: null, text: mode === "rotate" && mask ? <>Replaces <span className={styles.mono}>{mask}</span> once the new key connects</> : `Create one at ${spec.console}` };

  const saveLabel = phase === "testing" ? <><Spinner />Testing</>
    : phase === "connected" ? <><Check aria-hidden="true" />{mode === "rotate" ? "Rotated" : "Saved"}</>
    : mode === "rotate" ? "Rotate" : "Save key";

  return (
    <form className={styles.form} onSubmit={submit} noValidate data-phase={phase}>
      <label htmlFor={inputId} className={styles.srOnly}>{mode === "rotate" ? `New ${spec.name} key` : `${spec.name} API key`}</label>
      <input ref={inputRef} id={inputId} className={styles.input} value={value} readOnly={busy}
        placeholder={spec.placeholder} autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false}
        aria-invalid={formatError || phase === "rejected" || undefined} aria-describedby={helpId}
        data-tone={formatError || phase === "rejected" ? "bad" : phase === "connected" ? "ok" : undefined}
        onChange={event => { setValue(event.target.value); if (phase === "rejected") setPhase("edit"); }}
        onBlur={() => { if (value.trim()) setTouched(true); }} onKeyDown={onKeyDown} />
      <Button type="button" variant="ghost" size="sm" className={styles.cancel} onClick={() => { controller.current?.abort(); onCancel(); }}>Cancel</Button>
      <Button type="submit" variant="primary" size="sm" className={styles.save} aria-disabled={busy || undefined}>{saveLabel}</Button>
      <p id={helpId} className={styles.help} data-tone={help.tone} aria-live="polite">
        <Swap id={help.id} reduced={reduced}><span className={styles.helpInner}>{help.icon}<span className={styles.helpText}>{help.text}</span></span></Swap>
      </p>
      <button type="button" className={styles.sample} disabled={busy}
        onClick={() => { setValue(spec.sample()); setTouched(false); setPhase("edit"); inputRef.current?.focus(); }}>
        Use sample key
      </button>
    </form>
  );
}

export default ProviderKeys;
