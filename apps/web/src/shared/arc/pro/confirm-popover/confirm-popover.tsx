"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties, FormEvent, KeyboardEvent as ReactKeyboardEvent, ReactNode } from "react";
import { AnimatePresence, animate, motion, useMotionValue, useReducedMotion, useTransform } from "motion/react";
import type { Transition } from "motion/react";
import { Check, CircleAlert } from "lucide-react";
import { motionTokens } from "../../lib/motion-tokens";
import styles from "./confirm-popover.module.css";

/** Where the control is: resting, asking, running the action, finished, or failed. */
export type ConfirmPopoverPhase = "idle" | "confirming" | "working" | "success" | "error";

/** Passed to onConfirm so a long action can report progress and notice when it is abandoned. */
export interface ConfirmPopoverContext {
  /** Reports progress from 0 to 1. Without it the bar runs an indeterminate sweep. */
  setProgress: (value: number) => void;
  /** Aborted if the component unmounts while the action runs. */
  signal: AbortSignal;
}

/**
 * A destructive button that asks in place. Pressing it grows the button itself into a small confirmation surface that states the
 * consequence, with Cancel and Confirm, and an optional phrase to type first. Confirming turns the Confirm button into the progress
 * bar, then the surface folds back into the button with a check, or stays open with the error and Try again. It is not a modal:
 * Escape and a press outside cancel, focus moves into the surface and back to the button.
 */
export interface ConfirmPopoverProps {
  /** The trigger label, such as "Delete project". */
  children: ReactNode;
  /** A plain icon before the trigger label. */
  icon?: ReactNode;
  /** The question, such as "Delete Atlas?". */
  title: ReactNode;
  /** The consequence, in one or two short sentences. */
  description?: ReactNode;
  /** A phrase to type before Confirm unlocks, such as the project name. Matching ignores case and outer spaces. */
  confirmText?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Shown on the progress bar while onConfirm runs. */
  pendingLabel?: string;
  /** Shown with a check in the button's shape once onConfirm resolves. */
  successLabel?: string;
  /** Heading of the failure. The rejection's message is shown under it. */
  errorTitle?: ReactNode;
  retryLabel?: string;
  /** danger tints the trigger and fills Confirm in red. neutral uses the foreground for serious but reversible actions. */
  tone?: "danger" | "neutral";
  /** Runs the action. Return a promise to show progress; a rejection shows the failure with Try again. */
  onConfirm?: (ctx: ConfirmPopoverContext) => void | Promise<unknown>;
  onCancel?: () => void;
  /** Called once the success state has been shown and the button is back at rest. */
  onDone?: () => void;
  onError?: (error: unknown) => void;
  /** Controlled open state of the question. Pair with onOpenChange. */
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  onPhaseChange?: (phase: ConfirmPopoverPhase) => void;
  /** Which edge of the button the surface keeps. It shifts to stay inside the window either way. */
  align?: "start" | "center" | "end";
  /** Grow downward, upward, or toward the side with more room. */
  side?: "bottom" | "top" | "auto";
  /** Width of the open surface in px. It never exceeds the window less 16px each side. */
  width?: number;
  /** Milliseconds the success state holds before the button returns to rest. */
  resultDuration?: number;
  disabled?: boolean;
  className?: string;
  style?: CSSProperties;
}

/** The surface keeps one edge of the button still while it grows: right when it opens toward the start, otherwise left, shifted by x. */
interface Geometry { tw: number; th: number; radius: number; w: number; x: number; up: boolean; right: boolean }

const PANEL_RADIUS = 22;
const REDUCED: Transition = { duration: 0 };
const normalize = (s: string) => s.trim().toLowerCase();

export function ConfirmPopover({
  children,
  icon,
  title,
  description,
  confirmText,
  confirmLabel = "Delete",
  cancelLabel = "Cancel",
  pendingLabel = "Deleting",
  successLabel = "Deleted",
  errorTitle = "That didn't work",
  retryLabel = "Try again",
  tone = "danger",
  onConfirm,
  onCancel,
  onDone,
  onError,
  open: openProp,
  defaultOpen = false,
  onOpenChange,
  onPhaseChange,
  align = "start",
  side = "auto",
  width = 320,
  resultDuration = 1600,
  disabled,
  className,
  style,
}: ConfirmPopoverProps) {
  const reduced = useReducedMotion() ?? false;
  const uid = useId();
  const titleId = `${uid}-title`;
  const descId = `${uid}-desc`;
  const inputId = `${uid}-input`;

  const [phase, setPhaseState] = useState<ConfirmPopoverPhase>(defaultOpen ? "confirming" : "idle");
  /** The surface stays mounted while it folds back into the button. */
  const [mounted, setMounted] = useState(defaultOpen);
  const [geo, setGeo] = useState<Geometry | null>(null);
  const [panelHeight, setPanelHeight] = useState(0);
  const [typed, setTyped] = useState("");
  const [progress, setProgressState] = useState<number | null>(null);
  const [error, setError] = useState<string>("");

  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const surfaceRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const runRef = useRef(0);
  const resultTimer = useRef<number | undefined>(undefined);
  const returnFocusRef = useRef(false);
  const confirmRef = useRef<HTMLButtonElement>(null);

  const fill = useMotionValue(0);
  /** A short, damped head shake for a refused phrase or a failure. */
  const shakeX = useMotionValue(0);
  const shake = useCallback(() => {
    if (reduced) return;
    animate(shakeX, [0, -7, 6, -4, 3, -1, 0], { duration: .42, ease: motionTokens.ease.standard });
  }, [reduced, shakeX]);
  const fillClip = useTransform(fill, v => `inset(0 ${(1 - Math.min(1, Math.max(0, v))) * 100}% 0 0)`);
  /* The surface slides by x while it grows when it has to shift to stay on screen. The faces counter that slide, so the button face
     stays over the button and the panel stays where it will settle, and nothing travels with the moving edge. */
  const surfaceX = useMotionValue(0);
  const panelX = useMotionValue(0);
  const faceX = useTransform(surfaceX, v => -v);
  const panelOffset = useTransform(() => panelX.get() - surfaceX.get());

  const setPhase = useCallback((next: ConfirmPopoverPhase) => {
    setPhaseState(next);
    onPhaseChange?.(next);
  }, [onPhaseChange]);

  const measure = useCallback((): Geometry | null => {
    const trigger = triggerRef.current;
    if (!trigger) return null;
    const rect = trigger.getBoundingClientRect();
    const vw = document.documentElement.clientWidth;
    const vh = window.innerHeight;
    const w = Math.max(rect.width, Math.min(width, vw - 32));
    const wanted = align === "end" ? rect.width - w : align === "center" ? (rect.width - w) / 2 : 0;
    const x = Math.min(Math.max(wanted, 16 - rect.left), vw - 16 - w - rect.left);
    const right = Math.abs(x - (rect.width - w)) < .5 && x < 0;
    const up = side === "top" || (side === "auto" && vh - rect.bottom < 280 && rect.top > vh - rect.bottom);
    return { tw: rect.width, th: rect.height, radius: parseFloat(getComputedStyle(trigger).borderTopLeftRadius) || 14, w, x: right ? 0 : x, up, right };
  }, [align, side, width]);

  const isOpen = phase === "confirming" || phase === "working" || phase === "error";

  const openNow = useCallback(() => {
    const g = measure();
    if (!g) return;
    window.clearTimeout(resultTimer.current);
    setGeo(g);
    panelX.set(g.x);
    setTyped("");
    setError("");
    setProgressState(null);
    setMounted(true);
    setPhase("confirming");
    fill.set(confirmText ? 0 : 1);
  }, [confirmText, fill, measure, panelX, setPhase]);

  const close = useCallback((focusTrigger = true) => {
    returnFocusRef.current = focusTrigger;
    if (focusTrigger && rootRef.current?.contains(document.activeElement)) surfaceRef.current?.focus({ preventScroll: true });
    setPhase("idle");
  }, [setPhase]);

  /* The trigger only takes focus back once the surface has folded into it and unmounted; a hidden button cannot hold focus. */
  useEffect(() => {
    if (mounted || !returnFocusRef.current) return;
    returnFocusRef.current = false;
    triggerRef.current?.focus({ preventScroll: true });
  }, [mounted]);

  /* Unmount the surface once it is back at rest, even if an animation never reports completion. */
  useEffect(() => {
    if (phase !== "idle" || !mounted) return;
    const id = window.setTimeout(() => setMounted(false), 900);
    return () => window.clearTimeout(id);
  }, [phase, mounted]);

  /* Controlled open: follow the prop when it changes. */
  const openRef = useRef(openProp);
  useEffect(() => {
    if (openProp === undefined || openProp === openRef.current) return;
    openRef.current = openProp;
    const id = requestAnimationFrame(() => {
      if (openProp && !isOpen) openNow();
      else if (!openProp && (phase === "confirming" || phase === "error")) close(false);
    });
    return () => cancelAnimationFrame(id);
  }, [openProp, isOpen, phase, openNow, close]);

  const requestOpen = () => {
    if (disabled || isOpen) return;
    openRef.current = true;
    openNow();
    onOpenChange?.(true);
  };

  const cancel = useCallback(() => {
    if (phase !== "confirming" && phase !== "error") return;
    openRef.current = false;
    onCancel?.();
    onOpenChange?.(false);
    close();
  }, [close, onCancel, onOpenChange, phase]);

  /* Measure the open face before paint so the surface knows how tall to grow. */
  useLayoutEffect(() => {
    const panel = panelRef.current;
    if (!panel || !isOpen) return;
    setPanelHeight(panel.offsetHeight);
    const ro = new ResizeObserver(() => setPanelHeight(panel.offsetHeight));
    ro.observe(panel);
    return () => ro.disconnect();
  }, [isOpen, mounted]);

  /* Keep the geometry right if the window changes size while open. */
  useEffect(() => {
    if (!isOpen) return;
    const onResize = () => { const g = measure(); if (g) { setGeo(g); panelX.set(g.x); } };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [isOpen, measure, panelX]);

  /* Focus: the phrase field when there is one, otherwise Cancel, the safe choice. */
  useEffect(() => {
    if (phase !== "confirming") return;
    const id = requestAnimationFrame(() => (inputRef.current ?? cancelRef.current)?.focus({ preventScroll: true }));
    return () => cancelAnimationFrame(id);
  }, [phase]);

  /* A press outside cancels an open question; it never interrupts the running action. */
  useEffect(() => {
    if (phase !== "confirming" && phase !== "error") return;
    const onDown = (event: PointerEvent) => {
      const root = rootRef.current;
      if (root && event.target instanceof Node && !root.contains(event.target)) cancel();
    };
    document.addEventListener("pointerdown", onDown, true);
    return () => document.removeEventListener("pointerdown", onDown, true);
  }, [phase, cancel]);

  useEffect(() => () => { abortRef.current?.abort(); window.clearTimeout(resultTimer.current); }, []);

  const matched = !confirmText || normalize(typed) === normalize(confirmText);

  const onType = (value: string) => {
    setTyped(value);
    if (!confirmText) return;
    const target = normalize(confirmText);
    const typedNorm = value.trimStart().toLowerCase();
    let n = 0;
    while (n < typedNorm.length && n < target.length && typedNorm[n] === target[n]) n++;
    const ratio = n === typedNorm.length || normalize(value) === target ? n / target.length : 0;
    animate(fill, ratio, reduced ? REDUCED : motionTokens.spring.snappy);
  };

  const run = async (event?: FormEvent) => {
    event?.preventDefault();
    if (phase === "working") return;
    if (!matched) {
      shake();
      inputRef.current?.focus();
      return;
    }
    const id = ++runRef.current;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setError("");
    setProgressState(null);
    animate(fill, 0, reduced ? REDUCED : { ...motionTokens.spring.smooth, visualDuration: .3 });
    setPhase("working");
    surfaceRef.current?.focus({ preventScroll: true });
    const setProgress = (value: number) => {
      if (runRef.current !== id) return;
      const v = Math.min(1, Math.max(0, value));
      setProgressState(v);
      animate(fill, v, reduced ? REDUCED : motionTokens.spring.smooth);
    };
    try {
      await onConfirm?.({ setProgress, signal: controller.signal });
      if (runRef.current !== id) return;
      await animate(fill, 1, reduced ? REDUCED : { ...motionTokens.spring.smooth, visualDuration: .25 });
      setPhase("success");
      onOpenChange?.(false);
      openRef.current = false;
      resultTimer.current = window.setTimeout(() => {
        const active = document.activeElement;
        returnFocusRef.current = active === document.body || !!rootRef.current?.contains(active);
        setPhase("idle");
        onDone?.();
      }, resultDuration);
    } catch (err) {
      if (runRef.current !== id || controller.signal.aborted) return;
      onError?.(err);
      setError(err instanceof Error ? err.message : typeof err === "string" ? err : "");
      animate(fill, 1, reduced ? REDUCED : motionTokens.spring.smooth);
      setPhase("error");
      shake();
      requestAnimationFrame(() => confirmRef.current?.focus({ preventScroll: true }));
    }
  };

  const onSurfaceKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") { event.stopPropagation(); event.preventDefault(); cancel(); return; }
    if (event.key !== "Tab") return;
    const focusables = [...event.currentTarget.querySelectorAll<HTMLElement>("button:not([disabled]), input:not([disabled])")].filter(el => !el.closest("[inert]"));
    if (!focusables.length) { event.preventDefault(); return; }
    const first = focusables[0], last = focusables[focusables.length - 1];
    if (event.shiftKey && (document.activeElement === first || document.activeElement === event.currentTarget)) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  };

  const shapeOpen = isOpen;
  const g = geo;
  const target = !g ? undefined : shapeOpen
    ? { width: g.w, height: panelHeight || g.th, x: g.x, borderRadius: PANEL_RADIUS }
    : { width: g.tw, height: g.th, x: 0, borderRadius: g.radius };
  const sizeTransition: Transition = reduced ? REDUCED : shapeOpen ? motionTokens.spring.morph : { ...motionTokens.spring.smooth, visualDuration: .36 };
  const face = shapeOpen ? "panel" : phase === "success" ? "success" : "trigger";
  const faceIn = (delay = 0): Transition => reduced ? { duration: motionTokens.duration.fast } : { ...motionTokens.spring.snappy, delay, filter: { duration: .2, delay } };

  const status = phase === "confirming" ? "" : phase === "working" ? `${pendingLabel}${progress !== null ? `, ${Math.round(progress * 100)} percent` : ""}` : phase === "success" ? successLabel : phase === "error" ? `${typeof errorTitle === "string" ? errorTitle : "Failed"}. ${error}` : "";
  const barLabel = phase === "working" ? `${pendingLabel}…` : phase === "error" ? retryLabel : confirmLabel;

  return <div ref={rootRef} className={[styles.root, className].filter(Boolean).join(" ")} style={style} data-tone={tone} data-phase={phase}>
    <button
      ref={triggerRef}
      type="button"
      className={styles.trigger}
      onClick={requestOpen}
      disabled={disabled}
      aria-haspopup="dialog"
      aria-expanded={isOpen}
      data-hidden={mounted || undefined}
      tabIndex={mounted ? -1 : undefined}
    >
      {icon ? <span className={styles.icon} aria-hidden>{icon}</span> : null}
      <span>{children}</span>
    </button>

    {mounted && g ? <motion.div
      ref={surfaceRef}
      className={styles.surface}
      data-shape={face}
      data-up={g.up || undefined}
      data-right={g.right || undefined}
      role={shapeOpen ? "alertdialog" : undefined}
      aria-modal={shapeOpen ? false : undefined}
      aria-labelledby={shapeOpen ? titleId : undefined}
      aria-describedby={shapeOpen ? descId : undefined}
      aria-busy={phase === "working" || undefined}
      tabIndex={-1}
      style={{ x: surfaceX }}
      initial={{ width: g.tw, height: g.th, x: 0, borderRadius: g.radius }}
      animate={target}
      transition={sizeTransition}
      onAnimationComplete={() => { if (phase === "idle") setMounted(false); }}
      onKeyDown={onSurfaceKeyDown}
    >
      <AnimatePresence initial={false}>
        {face === "trigger" ? <motion.span
          key="trigger"
          className={styles.faceTrigger}
          style={{ width: g.tw, height: g.th, x: faceX }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: motionTokens.duration.instant } }}
          transition={faceIn(.08)}
          aria-hidden
        >
          {icon ? <span className={styles.icon}>{icon}</span> : null}
          <span>{children}</span>
        </motion.span> : null}

        {face === "success" ? <motion.span
          key="success"
          className={styles.faceSuccess}
          style={{ width: g.tw, height: g.th, x: faceX }}
          initial={reduced ? { opacity: 0 } : { opacity: 0, scale: .9, filter: `blur(${motionTokens.blur.soft}px)` }}
          animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
          exit={{ opacity: 0, transition: { duration: motionTokens.duration.instant } }}
          transition={faceIn(.1)}
        >
          <motion.span
            className={styles.check}
            initial={reduced ? false : { scale: .4, rotate: -30 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={reduced ? REDUCED : { ...motionTokens.spring.morph, delay: .12 }}
          ><Check size={16} strokeWidth={2.25} aria-hidden /></motion.span>
          <span>{successLabel}</span>
        </motion.span> : null}

        {face === "panel" ? <motion.div
          key="panel"
          ref={panelRef}
          className={styles.panel}
          data-up={g.up || undefined}
          style={{ width: g.w, x: panelOffset }}
          initial={reduced ? { opacity: 0 } : { opacity: 0, y: g.up ? 6 : -6, filter: `blur(${motionTokens.blur.soft}px)` }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          exit={reduced ? { opacity: 0 } : { opacity: 0, filter: `blur(${motionTokens.blur.subtle}px)`, transition: { duration: motionTokens.duration.instant } }}
          transition={faceIn(.06)}
        >
          <motion.form className={styles.form} onSubmit={run} style={{ x: shakeX }} noValidate>
            <div className={styles.copy}>
              <h2 id={titleId} className={styles.title}>{title}</h2>
              {description ? <p id={descId} className={styles.description}>{description}</p> : null}
            </div>

            {confirmText ? <div className={styles.field}>
              <label htmlFor={inputId} className={styles.fieldLabel}>Type <span className={styles.phrase}>{confirmText}</span> to confirm</label>
              <input
                ref={inputRef}
                id={inputId}
                className={styles.input}
                value={typed}
                onChange={event => onType(event.target.value)}
                placeholder={confirmText}
                autoComplete="off"
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck={false}
                disabled={phase === "working"}
                aria-invalid={typed.length > 0 && !matched ? true : undefined}
              />
            </div> : null}

            <AnimatePresence initial={false}>
              {phase === "error" ? <motion.div
                key="error"
                className={styles.errorWrap}
                initial={reduced ? { opacity: 0 } : { opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={reduced ? { opacity: 0 } : { opacity: 0, height: 0 }}
                transition={reduced ? REDUCED : motionTokens.spring.smooth}
              >
                <p className={styles.error} role="alert">
                  <CircleAlert size={16} strokeWidth={1.75} aria-hidden />
                  <span><span className={styles.errorTitle}>{errorTitle}</span>{error ? <span className={styles.errorText}>{error}</span> : null}</span>
                </p>
              </motion.div> : null}
            </AnimatePresence>

            <div className={styles.actions}>
              <motion.span
                className={styles.cancelSlot}
                initial={false}
                animate={phase === "working" ? { flexGrow: 0, opacity: 0, marginRight: 0 } : { flexGrow: 1, opacity: 1, marginRight: 8 }}
                transition={reduced ? REDUCED : motionTokens.spring.smooth}
                inert={phase === "working"}
              >
                <button ref={cancelRef} type="button" className={styles.cancel} onClick={cancel}>{cancelLabel}</button>
              </motion.span>
              <button
                ref={confirmRef}
                type="submit"
                className={styles.confirm}
                data-locked={!matched || undefined}
                data-working={phase === "working" || undefined}
                data-indeterminate={phase === "working" && progress === null || undefined}
                aria-disabled={!matched || phase === "working" || undefined}
              >
                <span className={styles.confirmLabel}>
                  <span>{barLabel}</span>
                  {phase === "working" && progress !== null ? <span className={styles.percent}>{Math.round(progress * 100)}%</span> : null}
                </span>
                <motion.span className={styles.fill} style={{ clipPath: fillClip }} aria-hidden>
                  <span className={styles.confirmLabel}>
                    <span>{barLabel}</span>
                    {phase === "working" && progress !== null ? <span className={styles.percent}>{Math.round(progress * 100)}%</span> : null}
                  </span>
                </motion.span>
                {phase === "working" && progress === null ? <span className={styles.sweep} aria-hidden /> : null}
              </button>
            </div>
          </motion.form>
        </motion.div> : null}
      </AnimatePresence>
    </motion.div> : null}

    <span className={styles.srOnly} role="status" aria-live="polite">{status}</span>
  </div>;
}
