"use client";

import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";
import { AnimatePresence, animate, motion, useReducedMotion, type AnimationPlaybackControls, type Transition } from "motion/react";
import { Check, CircleAlert, CircleCheck, CircleDashed, CircleStop, FileText, RotateCcw, Square } from "lucide-react";
import { Avatar } from "../../avatar/avatar";
import { Button } from "../../button/button";
import { CopyButton } from "../../copy-button/copy-button";
import SegmentedControl from "../../segmented-control/segmented-control";
import { Slider } from "../../slider/slider";
import { TextShimmer } from "../../text-shimmer/text-shimmer";
import { Tooltip } from "../../tooltip/tooltip";
import { motionTokens } from "../../lib/motion-tokens";
import { TLDR_TARGET_WORDS, simulateTldr, streamResult, tldrDefaultModel, tldrPointCount, tldrSampleArticle } from "./tldr-toggle-data";
import type { TldrArticle, TldrKeyPoint, TldrLength, TldrMode, TldrModel, TldrResult, TldrStreamEvent, TldrSummarize } from "./tldr-toggle-types";
import styles from "./tldr-toggle.module.css";

export type { TldrArticle, TldrKeyPoint, TldrLength, TldrMode, TldrModel, TldrParagraph, TldrRequest, TldrResult, TldrStreamEvent, TldrSummarize } from "./tldr-toggle-types";
export { TLDR_TARGET_WORDS, chunkText, sampleResult, simulateTldr, streamResult, tldrDefaultModel, tldrSampleArticle, type SimulateTldrOptions } from "./tldr-toggle-data";

export interface TldrToggleProps {
  /** The article to show and summarize. Defaults to a sample engineering post. */
  article?: TldrArticle;
  /** Produces the summary or key points. Leave it out to run the built-in simulation, which sends nothing. */
  summarize?: TldrSummarize;
  /** The model credited under the result. Defaults to Claude Haiku 5.5. */
  model?: TldrModel;
  /** Controlled mode. Pair with onModeChange. */
  mode?: TldrMode;
  defaultMode?: TldrMode;
  onModeChange?: (mode: TldrMode) => void;
  /** Controlled length, 1 to 5. Pair with onLengthChange. */
  length?: TldrLength;
  defaultLength?: TldrLength;
  /** Called once a slider drag is released or a key moves it, not on every step. */
  onLengthChange?: (length: TldrLength) => void;
  /** Called when a finished summary or list arrives, for analytics or a server-side cache. */
  onComplete?: (result: TldrResult) => void;
  /** Called when a key point's jump link is used, with the source paragraph id. */
  onJump?: (paragraphId: string) => void;
  /** Opens the summary by itself once the card is in view, until the reader touches anything. Defaults to true without `summarize`. */
  autoPlay?: boolean;
  /** Adds "Simulated, nothing was sent" to announcements. Defaults to true without `summarize`. */
  simulated?: boolean;
  className?: string;
}

type RunStatus = "thinking" | "streaming" | "done" | "stopped" | "error";
interface Run {
  id: number;
  key: string;
  mode: "summary" | "points";
  length: TldrLength;
  status: RunStatus;
  paras: string[][];
  points: { source: string; chunks: string[] }[];
  error?: string;
  /** A cached result shown again: no chunk fade. */
  instant?: boolean;
}

const cx = (...names: (string | false | null | undefined)[]) => names.filter(Boolean).join(" ");
const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`;
const countWords = (text: string) => text.split(/\s+/).filter(Boolean).length;
const MODES = [{ value: "full", label: "Full" }, { value: "summary", label: "Summary" }, { value: "points", label: "Key points" }];
const LENGTH_MARKS = [1, 2, 3, 4, 5];
const ease = [...motionTokens.ease.standard] as [number, number, number, number];
/* Height: one critically damped spring for every change. Views: a single crossfade, old out fast, new in a touch slower. */
const HEIGHT: Transition = { type: "spring", visualDuration: 0.26, bounce: 0 };
const viewIn: Transition = { duration: 0.16, ease };
const viewOut: Transition = { duration: 0.1, ease };

function isAsyncIterable(value: unknown): value is AsyncIterable<TldrStreamEvent> {
  return typeof value === "object" && value !== null && Symbol.asyncIterator in value;
}

function runText(run: Run) {
  return run.mode === "points"
    ? run.points.map(point => point.chunks.join("").trim()).filter(Boolean).join("\n")
    : run.paras.map(chunks => chunks.join("").trim()).filter(Boolean).join("\n\n");
}

function apply(run: Run, event: TldrStreamEvent): Run {
  if (event.type === "point") return { ...run, status: "streaming", points: [...run.points, { source: event.source, chunks: [] }] };
  if (run.mode === "points") {
    const points = run.points.length ? run.points.slice() : [{ source: "", chunks: [] }];
    const last = points[points.length - 1]!;
    points[points.length - 1] = { ...last, chunks: [...last.chunks, event.text] };
    return { ...run, status: "streaming", points };
  }
  const paras = run.paras.slice();
  event.text.split(/\n{2,}/).forEach((part, index) => {
    if (index > 0) paras.push([]);
    if (part) { const at = paras.length - 1; paras[at] = [...paras[at]!, part]; }
  });
  return { ...run, status: "streaming", paras };
}

/**
 * Springs the clip to the height of its content whenever the content changes (a view swap, streamed text), so the page
 * below glides instead of jumping. A width change from the container cuts straight to the new height.
 */
function useAutoHeight(reduced: boolean) {
  const outer = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const box = outer.current, content = inner.current;
    if (!box || !content || typeof ResizeObserver === "undefined") return;
    let height = content.offsetHeight, width = content.offsetWidth;
    let controls: AnimationPlaybackControls | undefined;
    const release = () => { box.style.height = ""; controls = undefined; };
    const observer = new ResizeObserver(() => {
      const nextHeight = content.offsetHeight, nextWidth = content.offsetWidth;
      const resized = nextWidth !== width;
      width = nextWidth;
      if (nextHeight === height) return;
      const from = controls ? box.getBoundingClientRect().height : height;
      height = nextHeight;
      controls?.stop();
      if (reduced || resized) { release(); return; }
      box.style.height = `${from}px`;
      const mine = animate(box, { height: nextHeight }, HEIGHT);
      controls = mine;
      mine.then(() => { if (controls === mine) release(); });
    });
    observer.observe(content);
    return () => { observer.disconnect(); controls?.stop(); };
  }, [reduced]);
  return { outer, inner };
}

/** The article itself. A jump scrolls its paragraph into view once the height has settled, then highlights it briefly. */
function ArticleBody({ article, focus, reduced }: { article: TldrArticle; focus: { id: string; token: number } | null; reduced: boolean }) {
  const nodes = useRef(new Map<string, HTMLParagraphElement>());
  const [lit, setLit] = useState<string | null>(null);
  useEffect(() => {
    if (!focus) return;
    let clear = 0;
    const go = window.setTimeout(() => {
      const node = nodes.current.get(focus.id);
      if (!node) return;
      node.scrollIntoView({ block: "center", behavior: reduced ? "auto" : "smooth" });
      node.focus({ preventScroll: true });
      setLit(focus.id);
      clear = window.setTimeout(() => setLit(null), 1800);
    }, reduced ? 0 : 280);
    return () => { window.clearTimeout(go); window.clearTimeout(clear); };
  }, [focus, reduced]);
  return <div className={styles.article}>
    {article.paragraphs.map(paragraph => <p key={paragraph.id} ref={node => { if (node) nodes.current.set(paragraph.id, node); else nodes.current.delete(paragraph.id); }} className={styles.para} data-lit={lit === paragraph.id || undefined} tabIndex={-1}>{paragraph.text}</p>)}
  </div>;
}

/**
 * An article card with a Full, Summary and Key points switch and a length slider. Switching streams an AI summary in
 * place of the article while the card's height follows on a spring; key points arrive as a checklist whose jump links
 * scroll to and highlight the paragraph each point came from. Results are kept per mode and length, so switching back is
 * instant; Regenerate asks again. Stop or Escape ends a stream and keeps what arrived.
 */
export function TldrToggle({ article = tldrSampleArticle, summarize, model = tldrDefaultModel, mode: modeProp, defaultMode = "full", onModeChange, length: lengthProp, defaultLength = 2, onLengthChange, onComplete, onJump, autoPlay, simulated, className }: TldrToggleProps) {
  const reduced = !!useReducedMotion();
  const [modeState, setModeState] = useState<TldrMode>(defaultMode);
  const [lengthState, setLengthState] = useState<TldrLength>(defaultLength);
  const mode = modeProp ?? modeState;
  const length = lengthProp ?? lengthState;
  const [draft, setDraft] = useState<number>(length);
  const [seenLength, setSeenLength] = useState(length);
  if (seenLength !== length) { setSeenLength(length); setDraft(length); }
  const [lastGen, setLastGen] = useState<"summary" | "points">(mode === "points" ? "points" : "summary");
  if (mode !== "full" && mode !== lastGen) setLastGen(mode);

  const [run, setRun] = useState<Run | null>(null);
  const [nonce, setNonce] = useState(0);
  const [focus, setFocus] = useState<{ id: string; token: number } | null>(null);
  const [notice, setNotice] = useState("");
  const cache = useRef(new Map<string, Run>());
  const controller = useRef<AbortController | null>(null);
  const force = useRef(false);
  const runCount = useRef(0);
  const touched = useRef(false);
  const root = useRef<HTMLDivElement>(null);
  const { outer, inner } = useAutoHeight(reduced);

  const empty = article.paragraphs.length === 0;
  const isSimulated = simulated ?? !summarize;
  const simNote = isSimulated ? " Simulated, nothing was sent." : "";
  // Callbacks and inputs the stream reads without restarting it.
  const latest = useRef({ summarize, article, model, onComplete, onModeChange, simNote });
  useLayoutEffect(() => { latest.current = { summarize, article, model, onComplete, onModeChange, simNote }; });

  // A different article (by title and paragraph ids, so an inline object is fine) starts over with an empty cache.
  const articleKey = `${article.title}\n${article.paragraphs.map(paragraph => paragraph.id).join(",")}`;
  const cachedFor = useRef(articleKey);

  useEffect(() => {
    if (cachedFor.current !== articleKey) { cachedFor.current = articleKey; cache.current.clear(); }
    if (mode === "full" || empty) return;
    const key = `${mode}:${length}`;
    const cached = cache.current.get(key);
    if (cached && !force.current) { setRun({ ...cached, instant: true }); setNotice(`Showing the saved ${mode === "points" ? "key points" : "summary"}.`); return; }
    force.current = false;
    const abort = new AbortController();
    controller.current = abort;
    const { summarize: produce, article: source, model: credit } = latest.current;
    let current: Run = { id: ++runCount.current, key, mode, length, status: "thinking", paras: [[]], points: [] };
    setRun(current);
    setNotice(`${mode === "points" ? "Finding key points" : "Summarizing"} with ${credit.name}.`);
    (async () => {
      try {
        const request = { mode, length, targetWords: TLDR_TARGET_WORDS[length - 1], pointCount: tldrPointCount(length), article: source, signal: abort.signal };
        const output = produce ? produce(request) : simulateTldr(request);
        const events = isAsyncIterable(output) ? output : streamResult(await output, abort.signal);
        for await (const event of events) {
          if (abort.signal.aborted) return;
          current = apply(current, event);
          setRun(current);
        }
        if (abort.signal.aborted) return;
        current = { ...current, status: "done" };
        cache.current.set(key, current);
        setRun(current);
        const text = runText(current);
        const points: TldrKeyPoint[] | undefined = mode === "points" ? current.points.map(point => ({ source: point.source, text: point.chunks.join("").trim() })) : undefined;
        setNotice(`${mode === "points" ? `${plural(points?.length ?? 0, "key point")} ready.` : `Summary ready, ${plural(countWords(text), "word")}.`}${latest.current.simNote}`);
        latest.current.onComplete?.({ mode, length, text, points, words: countWords(text) });
      } catch (error) {
        if (abort.signal.aborted) return;
        const message = error instanceof Error && error.message ? error.message : "Something went wrong.";
        current = { ...current, status: "error", error: message };
        setRun(current);
        setNotice(`Couldn’t summarize. ${message}${latest.current.simNote}`);
      }
    })();
    return () => abort.abort();
  }, [mode, length, nonce, empty, articleKey]);

  function changeMode(next: TldrMode) {
    if (next === mode) return;
    if (modeProp === undefined) setModeState(next);
    latest.current.onModeChange?.(next);
  }
  function commitLength(next: number) {
    const value = Math.min(5, Math.max(1, Math.round(next))) as TldrLength;
    touched.current = true;
    if (value === length) return;
    if (lengthProp === undefined) setLengthState(value);
    onLengthChange?.(value);
  }
  const running = !!run && run.key === `${mode}:${length}` && (run.status === "thinking" || run.status === "streaming");
  function stop() {
    if (!running) return;
    controller.current?.abort();
    setRun(current => current && (current.status === "thinking" || current.status === "streaming") ? { ...current, status: "stopped" } : current);
    setNotice("Stopped. What arrived is kept.");
  }
  function regenerate() {
    force.current = true;
    setNonce(value => value + 1);
  }
  function jump(id: string) {
    const index = article.paragraphs.findIndex(paragraph => paragraph.id === id);
    onJump?.(id);
    setFocus(previous => ({ id, token: (previous?.token ?? 0) + 1 }));
    setNotice(`Showing paragraph ${index + 1} in the article.`);
    changeMode("full");
  }

  // Once in view, the preview opens the summary by itself, unless the reader got there first.
  const shouldAutoPlay = autoPlay ?? !summarize;
  useEffect(() => {
    const node = root.current;
    if (!shouldAutoPlay || !node || typeof IntersectionObserver === "undefined") return;
    let timer = 0;
    const observer = new IntersectionObserver(([entry]) => {
      window.clearTimeout(timer);
      if (!entry?.isIntersecting || touched.current) return;
      timer = window.setTimeout(() => {
        if (touched.current) return;
        touched.current = true;
        observer.disconnect();
        setModeState(current => modeProp === undefined && current === "full" ? "summary" : current);
        latest.current.onModeChange?.("summary");
      }, 1000);
    }, { threshold: 0.5 });
    observer.observe(node);
    return () => { observer.disconnect(); window.clearTimeout(timer); };
  }, [shouldAutoPlay, modeProp]);

  const shown = run && run.key === `${mode}:${length}` ? run : null;
  const status: RunStatus = shown?.status ?? "thinking";
  const text = shown ? runText(shown) : "";
  const words = countWords(text);
  const sliderMode = mode === "full" ? lastGen : mode;
  const format = (value: number) => sliderMode === "points" ? plural(tldrPointCount(value as TldrLength), "point") : `~${TLDR_TARGET_WORDS[value - 1]} words`;
  const totalWords = article.paragraphs.reduce((sum, paragraph) => sum + countWords(paragraph.text), 0);
  const readingTime = article.readingTime ?? `${Math.max(1, Math.ceil(totalWords / 230))} min read`;
  const viewKey = mode === "full" ? "full" : empty ? "empty" : `${mode}:${length}:${nonce}`;
  const stateKey = status === "done" ? `done-${mode}` : status;
  const actionKey = status === "thinking" || status === "streaming" ? "running" : status === "error" ? "error" : "result";
  const paragraphNumber = (id: string) => article.paragraphs.findIndex(paragraph => paragraph.id === id) + 1;

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    touched.current = true;
    if (event.key === "Escape" && running) { event.preventDefault(); stop(); }
  }

  const view = (() => {
    if (mode === "full") return empty ? null : <ArticleBody article={article} focus={focus} reduced={reduced} />;
    const instant = shown?.instant || reduced;
    const thinking = status === "thinking";
    return <div className={styles.gen}>
      <AnimatePresence initial={false}>
        {thinking && <motion.span key="thinking" className={styles.thinking} exit={{ opacity: 0, transition: viewOut }}>
          <TextShimmer>{mode === "points" ? "Finding key points" : `Reading ${plural(article.paragraphs.length, "paragraph")}`}</TextShimmer>
        </motion.span>}
      </AnimatePresence>
      {mode === "summary" && shown && <div className={styles.summary}>
        {shown.paras.filter(chunks => chunks.length).map((chunks, index) => <p key={index}>{instant ? chunks.join("") : chunks.map((chunk, at) => <span key={at} className={styles.chunk}>{chunk}</span>)}</p>)}
      </div>}
      {mode === "points" && shown && shown.points.length > 0 && <ul className={styles.points}>
        {shown.points.map((point, index) => {
          const done = index < shown.points.length - 1 || shown.status === "done";
          const number = paragraphNumber(point.source);
          return <li key={index} className={cx(styles.point, !instant && styles.enter)}>
            <span className={styles.pointIcon} data-done={done || undefined} aria-hidden="true"><CircleDashed size={16} className={styles.pending} /><CircleCheck size={16} className={styles.check} /></span>
            <span className={styles.pointText}>{instant ? point.chunks.join("") : point.chunks.map((chunk, at) => <span key={at} className={styles.chunk}>{chunk}</span>)}</span>
            {number > 0 && (running
              ? <span className={styles.jumpSlot} aria-hidden="true">¶{number}</span>
              : <Tooltip content="Show in article"><button type="button" className={styles.jump} onClick={() => jump(point.source)} aria-label={`Jump to paragraph ${number}: ${point.chunks.join("").trim()}`}>¶{number}</button></Tooltip>)}
          </li>;
        })}
      </ul>}
      {status === "error" && <div className={styles.error} role="alert">
        <CircleAlert size={16} aria-hidden="true" />
        <div className={styles.errorCopy}>
          <p className={styles.errorTitle}>Couldn’t {mode === "points" ? "find key points" : "summarize this article"}</p>
          <p className={styles.errorText}>{shown?.error}{isSimulated ? " Simulated, nothing was sent." : ""}</p>
        </div>
      </div>}
    </div>;
  })();

  return <div ref={root} className={cx(styles.root, className)} onPointerDown={() => { touched.current = true; }} onKeyDown={onKeyDown}>
    <article className={styles.card} aria-busy={running || undefined}>
      <header className={styles.head}>
        {article.source && <div className={styles.source}>{article.source.mark && <span className={styles.sourceMark}>{article.source.mark}</span>}<span className={styles.truncate}>{article.source.name}</span></div>}
        <h3 className={styles.title}>{article.title}</h3>
        <div className={styles.byline}>
          {article.author && <><Avatar name={article.author.name} src={article.author.avatar} size="sm" className={styles.avatar} /><span className={styles.author}>{article.author.name}</span><span aria-hidden="true">·</span></>}
          <span className={styles.truncate}>{[article.date, readingTime].filter(Boolean).join(" · ")}</span>
        </div>
      </header>

      <div className={styles.controls}>
        <SegmentedControl label="Reading mode" options={MODES} value={mode} onValueChange={value => { touched.current = true; changeMode(value as TldrMode); }} />
        <div className={styles.length}>
          <Slider label="Length" value={draft} min={1} max={5} step={1} marks={LENGTH_MARKS} format={format} disabled={mode === "full" || empty} onValueChange={setDraft} onValueCommit={commitLength} />
        </div>
      </div>

      <div ref={outer} className={styles.clip}>
        <div ref={inner} className={styles.body}>
          <AnimatePresence mode="wait" initial={false}>
            <motion.div key={viewKey} initial={{ opacity: 0 }} animate={{ opacity: 1, transition: reduced ? { duration: 0 } : viewIn }} exit={{ opacity: 0, transition: reduced ? { duration: 0 } : viewOut }}>
              {empty
                ? <div className={styles.empty}><FileText size={16} aria-hidden="true" /><span>Nothing to summarize yet</span></div>
                : view}
            </motion.div>
          </AnimatePresence>

          <AnimatePresence initial={false}>
            {mode !== "full" && !empty && <motion.div key="foot" className={styles.foot} initial={{ opacity: 0 }} animate={{ opacity: 1, transition: viewIn }} exit={{ opacity: 0, transition: { duration: 0 } }}>
              <div className={styles.status}>
                {model.mark && <span className={styles.modelMark}>{model.mark}</span>}
                <span className={styles.modelName}>{model.name}</span>
                <span className={styles.dot} aria-hidden="true">·</span>
                <span className={styles.stateSlot}>
                  <AnimatePresence mode="wait" initial={false}>
                    <motion.span key={stateKey} className={styles.state} data-status={status} initial={{ opacity: 0 }} animate={{ opacity: 1, transition: viewIn }} exit={{ opacity: 0, transition: viewOut }}>
                      {status === "thinking" && "Thinking"}
                      {status === "streaming" && <TextShimmer>Writing</TextShimmer>}
                      {status === "done" && <><Check size={14} aria-hidden="true" />{mode === "points" ? plural(shown?.points.length ?? 0, "point") : plural(words, "word")}</>}
                      {status === "stopped" && <><CircleStop size={14} aria-hidden="true" />Stopped</>}
                      {status === "error" && <><CircleAlert size={14} aria-hidden="true" />Failed</>}
                    </motion.span>
                  </AnimatePresence>
                </span>
              </div>
              <div className={styles.actions}>
                <AnimatePresence mode="wait" initial={false}>
                  <motion.div key={actionKey} className={styles.actionSet} data-kind={actionKey} initial={{ opacity: 0 }} animate={{ opacity: 1, transition: viewIn }} exit={{ opacity: 0, transition: viewOut }}>
                    {actionKey === "running" && <Button variant="ghost" size="sm" className={styles.action} onClick={stop}><Square size={10} fill="currentColor" aria-hidden="true" />Stop</Button>}
                    {actionKey === "result" && <>
                      <CopyButton value={text} iconOnly variant="plain" label={mode === "points" ? "Copy key points" : "Copy summary"} className={styles.iconAction} disabled={!text} />
                      <Tooltip content="Regenerate"><Button variant="ghost" size="sm" className={cx(styles.action, styles.iconAction)} onClick={regenerate} aria-label="Regenerate"><RotateCcw size={16} aria-hidden="true" /></Button></Tooltip>
                    </>}
                    {actionKey === "error" && <Button variant="primary" size="sm" className={cx(styles.action, styles.retry)} onClick={regenerate}><RotateCcw size={14} aria-hidden="true" />Try again</Button>}
                  </motion.div>
                </AnimatePresence>
              </div>
            </motion.div>}
          </AnimatePresence>
        </div>
      </div>
    </article>
    <div className={styles.srOnly} role="status" aria-live="polite">{notice}</div>
  </div>;
}

export default TldrToggle;
