"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import * as Menu from "@radix-ui/react-dropdown-menu";
import { AnimatePresence, animate, motion, useReducedMotion } from "motion/react";
import type { AnimationPlaybackControls, Variants } from "motion/react";
import { Check, ChevronDown, CircleAlert, Languages, RotateCcw } from "lucide-react";
import { Avatar } from "../../avatar/avatar";
import { Button } from "../../button/button";
import { TextShimmer } from "../../text-shimmer/text-shimmer";
import { aiTranslateLanguages, aiTranslateSample, chunkText, detectLanguage, languageByCode, splitSentences } from "./ai-translate-data";
import type { AiTranslateLanguageCode } from "./ai-translate-data";
import { ClaudeMark } from "./ai-translate-marks";
import styles from "./ai-translate.module.css";

export type { AiTranslateLanguage, AiTranslateLanguageCode } from "./ai-translate-data";
export { aiTranslateLanguages, aiTranslateSample, detectLanguage } from "./ai-translate-data";

export interface AiTranslateRequest {
  /** The original text, always in the source language. */
  text: string;
  from: AiTranslateLanguageCode;
  to: AiTranslateLanguageCode;
  /** Aborted when the reader picks another language, shows the original or the component unmounts. */
  signal: AbortSignal;
}

/** Resolve the whole translation, or yield it in pieces as your model streams it. */
export type AiTranslateFn = (request: AiTranslateRequest) => Promise<string> | AsyncIterable<string>;

export interface AiTranslateProps {
  /** The text to translate. Defaults to a sample release note written in French. */
  text?: string;
  /** Language of `text`. Detected from the text when omitted. */
  sourceLanguage?: AiTranslateLanguageCode;
  /** Languages offered in the picker, in order. Defaults to all six. */
  languages?: AiTranslateLanguageCode[];
  /** The language on screen; the source language means the original. Pair with `onValueChange` to control it. */
  value?: AiTranslateLanguageCode;
  defaultValue?: AiTranslateLanguageCode;
  onValueChange?: (language: AiTranslateLanguageCode) => void;
  /** Your translation call. Without it, `translations` (or the sample) are streamed as a simulation. */
  translate?: AiTranslateFn;
  /** Ready translations for the simulation or for content you translated ahead of time. */
  translations?: Partial<Record<AiTranslateLanguageCode, string>>;
  /** Called once a translation has fully arrived. */
  onTranslate?: (result: { from: AiTranslateLanguageCode; to: AiTranslateLanguageCode; text: string }) => void;
  onError?: (error: Error, request: { from: AiTranslateLanguageCode; to: AiTranslateLanguageCode }) => void;
  /** Who wrote the text. Pass null to hide the header line. */
  author?: { name: string; role?: string; avatar?: string } | null;
  timestamp?: string;
  /** The model credited in the footer. Defaults to Claude Haiku 5.5. */
  model?: { name: string; mark?: ReactNode };
  /** Cycles through a few languages until the reader interacts. Defaults to true only for the bare sample. */
  autoPlay?: boolean;
  /** Says in the live status that nothing left the browser. Defaults to true when no `translate` is passed. */
  simulated?: boolean;
  className?: string;
}

type Phase = "idle" | "thinking" | "streaming" | "done" | "error";

/** What the paragraph shows: streamed chunks in the new language, then the previous text's remaining sentences, dimmed. */
interface Para {
  id: number;
  lang: AiTranslateLanguageCode;
  chunks: string[];
  pending: string[];
  pendingOffset: number;
  pendingLang: AiTranslateLanguageCode;
  /** Chunks fade in as they land. */
  live: boolean;
  /** The whole paragraph crossfades in when it replaces another. */
  fade: boolean;
}

const cx = (...names: (string | false | null | undefined)[]) => names.filter(Boolean).join(" ");
const TICK = 34;
const THINK = 560;
const AUTOPLAY = ["en", "de", "ja", "pt"] as AiTranslateLanguageCode[];
const ease = [0.22, 1, 0.36, 1] as const;
/** Height follows the text with a short critically damped spring, so lines never jump and never overshoot. */
const heightSpring = { type: "spring", visualDuration: 0.24, bounce: 0 } as const;

const textVariants: Variants = {
  enter: (fade: boolean) => fade ? { opacity: 0, y: 2 } : { opacity: 1, y: 0 },
  shown: { opacity: 1, y: 0, transition: { duration: 0.16, ease } },
  leave: (fade: boolean) => ({ opacity: 0, transition: { duration: fade ? 0.1 : 0 } }),
};

const paraText = (para: Para) => {
  const head = para.chunks.join("");
  const tail = para.pending.join("");
  return !tail ? head : head && !/\s$/.test(head) ? `${head} ${tail}` : head + tail;
};

const isAbort = (error: unknown, signal: AbortSignal) => signal.aborted || (error instanceof DOMException && error.name === "AbortError");

function wait(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal.aborted) { reject(new DOMException("Aborted", "AbortError")); return; }
    const timer = window.setTimeout(resolve, ms);
    signal.addEventListener("abort", () => { window.clearTimeout(timer); reject(new DOMException("Aborted", "AbortError")); }, { once: true });
  });
}

/** Springs the box to its content's height when the text grows or shrinks; a container resize cuts straight to the new height. */
function useAutoHeight(reduced: boolean) {
  const outer = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const box = outer.current, content = inner.current;
    if (!box || !content || typeof ResizeObserver === "undefined") return;
    let height = content.offsetHeight, width = content.offsetWidth;
    let controls: AnimationPlaybackControls | undefined;
    const release = () => { box.style.height = ""; box.style.overflow = ""; controls = undefined; };
    const observer = new ResizeObserver(() => {
      const nextHeight = content.offsetHeight, nextWidth = content.offsetWidth;
      const resized = nextWidth !== width;
      width = nextWidth;
      if (nextHeight === height) return;
      const from = controls ? box.getBoundingClientRect().height : height;
      height = nextHeight;
      controls?.stop();
      if (reduced || resized) { release(); return; }
      box.style.overflow = "hidden";
      controls = animate(box, { height: [from, nextHeight] }, { ...heightSpring, onComplete: release });
    });
    observer.observe(content);
    return () => { observer.disconnect(); controls?.stop(); };
  }, [reduced]);
  return { outer, inner };
}

/**
 * An inline translator for a message or paragraph. Picking a language streams the translation in place, sentence by
 * sentence, over the dimmed previous text; translations are cached, so switching back crossfades instantly.
 */
export function AiTranslate({
  text: textProp,
  sourceLanguage,
  languages: languageCodes,
  value: valueProp,
  defaultValue,
  onValueChange,
  translate,
  translations: translationsProp,
  onTranslate,
  onError,
  author: authorProp,
  timestamp: timestampProp,
  model = { name: "Claude Haiku 5.5", mark: <ClaudeMark title="Claude" /> },
  autoPlay,
  simulated,
  className,
}: AiTranslateProps) {
  const reduced = useReducedMotion() ?? false;
  const isSample = textProp === undefined;
  const text = textProp ?? aiTranslateSample.text;
  const source = sourceLanguage ?? (isSample ? aiTranslateSample.sourceLanguage : detectLanguage(text));
  const translations = translationsProp ?? (isSample ? aiTranslateSample.translations : undefined);
  const author = authorProp === undefined ? (isSample ? aiTranslateSample.author : null) : authorProp;
  const timestamp = timestampProp ?? (isSample ? aiTranslateSample.timestamp : undefined);
  const languages = (languageCodes ?? aiTranslateLanguages.map(language => language.code)).map(languageByCode);
  const isSimulated = simulated ?? !translate;
  const autoplayOn = autoPlay ?? (isSample && valueProp === undefined && !translate);

  const [innerValue, setInnerValue] = useState<AiTranslateLanguageCode>(defaultValue ?? source);
  const value = valueProp ?? innerValue;
  const [para, setPara] = useState<Para>(() => ({ id: 0, lang: source, chunks: [text], pending: [], pendingOffset: 0, pendingLang: source, live: false, fade: false }));
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [lastTarget, setLastTarget] = useState<AiTranslateLanguageCode | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const [visible, setVisible] = useState(true);
  const [handsOn, setHandsOn] = useState(false);

  const rootRef = useRef<HTMLElement>(null);
  const paraRef = useRef(para);
  const cache = useRef(new Map<AiTranslateLanguageCode, string>());
  const controller = useRef<AbortController | null>(null);
  const nextId = useRef(1);
  const step = useRef(0);
  /* Callbacks and data change identity every render; the runner reads the latest through a ref. */
  const latest = useRef({ text, source, translate, translations, onTranslate, onError, isSimulated });
  useLayoutEffect(() => {
    paraRef.current = para;
    latest.current = { text, source, translate, translations, onTranslate, onError, isSimulated };
  });
  const { outer, inner } = useAutoHeight(reduced);

  function select(code: AiTranslateLanguageCode) {
    /* Picking the language that just failed is a retry. */
    if (code === value && phase === "error") { setAttempt(count => count + 1); return; }
    if (valueProp === undefined) setInnerValue(code);
    onValueChange?.(code);
  }
  const selectRef = useRef(select);
  useLayoutEffect(() => { selectRef.current = select; });

  /*
   * The runner talks to the translation service, so it lives in a ref the effect calls: it reads the latest props,
   * starts one request for the language on screen and returns the abort for the effect's cleanup.
   */
  const shownText = useRef({ text, source });
  const run = useRef<(value: AiTranslateLanguageCode) => () => void>(() => () => {});
  useLayoutEffect(() => { run.current = (value: AiTranslateLanguageCode) => {
    const { text, source, translate, translations, isSimulated } = latest.current;
    let current = paraRef.current;
    const name = languageByCode(value).english;
    controller.current?.abort();
    const abort = new AbortController();
    controller.current = abort;
    setError(null);

    /* A new source text starts over: no stale translations, the new original on screen. */
    const reset = shownText.current.text !== text || shownText.current.source !== source;
    if (reset) {
      shownText.current = { text, source };
      cache.current.clear();
      setLastTarget(null);
      current = { id: nextId.current++, lang: source, chunks: [text], pending: [], pendingOffset: 0, pendingLang: source, live: false, fade: true };
      setPara(current);
    }

    if (value === source) {
      setPhase("idle");
      if (!reset && (current.lang !== source || current.live || current.pending.length)) {
        setPara({ id: nextId.current++, lang: source, chunks: [text], pending: [], pendingOffset: 0, pendingLang: source, live: false, fade: true });
        setAnnouncement(`Showing the original ${languageByCode(source).english}`);
      }
      return () => abort.abort();
    }

    setLastTarget(value);
    const cached = cache.current.get(value);
    if (cached !== undefined) {
      setPhase("done");
      if (current.lang !== value || current.live) setPara({ id: nextId.current++, lang: value, chunks: [cached], pending: [], pendingOffset: 0, pendingLang: value, live: false, fade: true });
      setAnnouncement(`Translated from ${languageByCode(source).english} to ${name}`);
      return () => abort.abort();
    }

    const previous = splitSentences(paraText(current));
    const id = nextId.current++;
    const chunks: string[] = [];
    let received = "";
    setPara({ id, lang: value, chunks: [], pending: previous, pendingOffset: 0, pendingLang: current.lang, live: true, fade: false });
    setPhase("thinking");
    setAnnouncement(`Translating to ${name}.${isSimulated ? " Simulated, nothing was sent." : ""}`);

    const push = (chunk: string) => {
      if (abort.signal.aborted || !chunk) return;
      chunks.push(chunk);
      received += chunk;
      /* Every sentence that has started in the new language retires one sentence of the previous text. */
      const replaced = splitSentences(received).length;
      setPara(para => para.id === id ? { ...para, chunks: [...chunks], pending: previous.slice(replaced), pendingOffset: replaced } : para);
      setPhase("streaming");
    };

    (async () => {
      try {
        let result: Promise<string> | AsyncIterable<string>;
        if (translate) result = translate({ text, from: source, to: value, signal: abort.signal });
        else {
          const ready = translations?.[value];
          result = wait(THINK, abort.signal).then(() => {
            if (ready === undefined) throw new Error(`No ${name} translation is available`);
            return ready;
          });
        }
        if (typeof (result as Promise<string>).then === "function") {
          const full = await (result as Promise<string>);
          for (const chunk of chunkText(full)) {
            if (chunks.length) await wait(TICK, abort.signal);
            push(chunk);
          }
        } else {
          for await (const delta of result as AsyncIterable<string>) {
            if (abort.signal.aborted) return;
            push(delta);
          }
        }
        if (abort.signal.aborted) return;
        const final = chunks.join("");
        if (!final.trim()) throw new Error("The translation came back empty");
        cache.current.set(value, final);
        setPara(para => para.id === id ? { ...para, pending: [], live: false } : para);
        setPhase("done");
        setAnnouncement(`Translated from ${languageByCode(source).english} to ${name}.${isSimulated ? " Simulated, nothing was sent." : ""}`);
        latest.current.onTranslate?.({ from: source, to: value, text: final });
      } catch (caught) {
        if (isAbort(caught, abort.signal)) return;
        const failure = caught instanceof Error ? caught : new Error(String(caught));
        /* Put back exactly what was on screen before, so a failure never leaves half a translation behind. */
        setPara({ ...current, id: nextId.current++, chunks: [paraText(current)], pending: [], pendingOffset: 0, live: false, fade: true });
        setPhase("error");
        setError(failure.message);
        setAnnouncement(`Couldn't translate to ${name}. ${failure.message}`);
        latest.current.onError?.(failure, { from: source, to: value });
      }
    })();
    return () => abort.abort();
  }; });
  useEffect(() => run.current(value), [value, attempt, text, source]);

  /* Autoplay: a short tour through a few languages and back to the original, paused off screen, stopped by any interaction. */
  useEffect(() => {
    const node = rootRef.current;
    if (!node || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(([entry]) => setVisible(entry?.isIntersecting ?? true), { threshold: 0.2 });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  const playing = autoplayOn && !handsOn && visible;
  useEffect(() => {
    if (!playing || phase === "thinking" || phase === "streaming" || phase === "error") return;
    if (reduced && step.current > 0) return;
    const atOriginal = value === source;
    const delay = step.current === 0 ? 900 : atOriginal ? 1800 : 2600;
    const timer = window.setTimeout(() => {
      const tour = AUTOPLAY.filter(code => code !== source);
      const index = step.current % (tour.length + 1);
      step.current += 1;
      if (index === tour.length) { selectRef.current(source); return; }
      if (index === 0) cache.current.clear();
      selectRef.current(tour[index]);
    }, delay);
    return () => window.clearTimeout(timer);
  }, [playing, phase, value, source, reduced]);

  const busy = phase === "thinking" || phase === "streaming";
  const showingOriginal = value === source;
  const toggleTarget = showingOriginal ? lastTarget : source;
  const sourceName = languageByCode(source).english;
  const targetName = languageByCode(value).english;
  const empty = !text.trim();

  let status: { key: string; label: string; shimmer?: boolean; tone?: "error" };
  if (phase === "error") status = { key: "error", label: "Couldn't translate", tone: "error" };
  else if (busy) status = { key: `busy-${value}`, label: `Translating to ${targetName}`, shimmer: true };
  else if (phase === "done") status = { key: `done-${value}`, label: `Translated from ${sourceName}` };
  else if (lastTarget) status = { key: "original", label: "Showing original" };
  else status = { key: "ready", label: model.name };

  return <section ref={rootRef} className={cx(styles.root, className)} aria-label={author ? `Message from ${author.name}` : "Translatable text"} onPointerDownCapture={() => setHandsOn(true)} onKeyDownCapture={() => setHandsOn(true)}>
    <header className={styles.head}>
      {author && <div className={styles.author}>
        <Avatar name={author.name} src={author.avatar} size="md" className={styles.avatar} />
        <div className={styles.byline}>
          <span className={styles.name}>{author.name}</span>
          {(author.role || timestamp) && <span className={styles.meta}>{[author.role, timestamp].filter(Boolean).join(" · ")}</span>}
        </div>
      </div>}
      {!empty && <span className={styles.chip}>
        <span className={styles.chipLabel}>{sourceLanguage ? "Written in" : "Detected"}</span>{sourceName}
      </span>}
    </header>

    <div ref={outer} className={styles.textClip}>
      <div ref={inner} className={styles.textStack}>
        {empty ? <p className={cx(styles.text, styles.empty)}>Nothing to translate yet.</p> : <AnimatePresence initial={false} custom={para.fade}>
          <motion.p key={para.id} lang={para.lang} className={styles.text} custom={para.fade} variants={reduced ? undefined : textVariants} initial="enter" animate="shown" exit="leave" aria-busy={busy || undefined}>
            {para.chunks.map((chunk, index) => <span key={index} className={para.live && !reduced ? styles.chunk : undefined}>{chunk}</span>)}
            {para.pending.length > 0 && <>
              {para.chunks.length > 0 && !/\s$/.test(para.chunks[para.chunks.length - 1]) && " "}
              {para.pending.map((sentence, index) => <span key={para.pendingOffset + index} lang={para.pendingLang} className={cx(styles.pending, reduced && styles.pendingStill)}>{sentence}</span>)}
            </>}
          </motion.p>
        </AnimatePresence>}
      </div>
    </div>

    <footer className={styles.foot}>
      <div className={styles.controls}>
        <Menu.Root modal={false}>
          <Menu.Trigger className={styles.trigger} disabled={empty} aria-label={`Translate to, ${showingOriginal ? "original" : languageByCode(value).native}`}>
            <Languages size={16} strokeWidth={1.75} aria-hidden="true" className={styles.triggerIcon} />
            <span className={styles.stack} aria-hidden="true">
              <span className={styles.stackItem} data-active={showingOriginal || undefined}>Translate</span>
              {languages.filter(language => language.code !== source).map(language => <span key={language.code} lang={language.code} className={styles.stackItem} data-active={value === language.code || undefined}>{language.native}</span>)}
            </span>
            <ChevronDown size={14} strokeWidth={1.75} aria-hidden="true" className={styles.chevron} />
          </Menu.Trigger>
          <Menu.Portal>
            <Menu.Content className={styles.menu} align="start" sideOffset={6} collisionPadding={12} loop>
              <Menu.Label className={styles.menuLabel}>Translate to</Menu.Label>
              <Menu.RadioGroup value={value} onValueChange={code => select(code as AiTranslateLanguageCode)}>
                {languages.map(language => <Menu.RadioItem key={language.code} value={language.code} className={styles.item}>
                  <span className={styles.itemCheck} aria-hidden="true"><Menu.ItemIndicator><Check size={14} strokeWidth={2} /></Menu.ItemIndicator></span>
                  <span className={styles.itemName} lang={language.code}>{language.native}</span>
                  <span className={styles.itemMeta}>{language.code === source ? "Original" : language.english}</span>
                </Menu.RadioItem>)}
              </Menu.RadioGroup>
            </Menu.Content>
          </Menu.Portal>
        </Menu.Root>

        <button type="button" className={styles.toggle} aria-pressed={showingOriginal && !!lastTarget} disabled={empty || !toggleTarget} onClick={() => toggleTarget && select(toggleTarget)}>
          <span className={styles.stack}>
            <span className={styles.stackItem} data-active={!(showingOriginal && lastTarget) || undefined} aria-hidden={showingOriginal && !!lastTarget}>Show original</span>
            <span className={styles.stackItem} data-active={(showingOriginal && !!lastTarget) || undefined} aria-hidden={!(showingOriginal && lastTarget)}>Show translation</span>
          </span>
        </button>
      </div>

      <div className={styles.status}>
        <AnimatePresence initial={false}>
          <motion.span key={status.key} className={styles.statusItem} data-tone={status.tone} initial={reduced ? false : { opacity: 0 }} animate={{ opacity: 1, transition: { duration: 0.16, ease } }} exit={{ opacity: 0, transition: { duration: reduced ? 0 : 0.1 } }}>
            {status.tone === "error"
              ? <CircleAlert size={16} strokeWidth={1.75} aria-hidden="true" className={styles.errorIcon} />
              : <span className={styles.mark} title={model.name}>{model.mark ?? <Languages size={16} strokeWidth={1.75} aria-hidden="true" />}</span>}
            {status.shimmer ? <TextShimmer className={styles.statusText}>{status.label}</TextShimmer> : <span className={styles.statusText} title={status.tone === "error" ? error ?? undefined : undefined}>{status.label}</span>}
            {status.tone === "error" && <Button variant="ghost" size="sm" className={styles.retry} onClick={() => setAttempt(count => count + 1)}><RotateCcw size={14} strokeWidth={1.75} aria-hidden="true" />Retry</Button>}
          </motion.span>
        </AnimatePresence>
      </div>
    </footer>

    <span className={styles.srOnly} role="status" aria-live="polite">{announcement}</span>
  </section>;
}

export default AiTranslate;
