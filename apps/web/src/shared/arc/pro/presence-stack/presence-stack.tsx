"use client";

import { ArcImage } from "../../lib/arc-provider";
import * as Popover from "@radix-ui/react-popover";
import { AnimatePresence, animate, motion, useMotionValue, useReducedMotion } from "motion/react";
import type { Transition } from "motion/react";
import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties, KeyboardEvent as ReactKeyboardEvent } from "react";
import { motionTokens } from "../../lib/motion-tokens";
import styles from "./presence-stack.module.css";

export type PresenceStatus = "active" | "idle" | "typing";

export interface PresencePerson {
  /** Stable id. Keys the avatar, so the same person keeps their place as the list changes. */
  id: string;
  name: string;
  /** Square portrait url. Initials show while it loads or when it is missing. */
  src?: string;
  /** Active shows a green dot, idle dims the portrait, typing turns the dot into a small typing indicator. Defaults to active. */
  status?: PresenceStatus;
  /** Where they are or what they do, such as "Editing Pricing". Shown in the list; defaults to the status. */
  detail?: string;
}

export interface PresenceStackProps {
  /** Everyone here now, in display order. Add, remove, reorder or change a status and the stack animates to match. */
  people: readonly PresencePerson[];
  /** Avatars shown before the rest collapse into a +N counter. */
  max?: number;
  size?: "sm" | "md" | "lg";
  /** The side the stack grows from. End suits a header, where the stack sits against the actions on the right. */
  align?: "start" | "end";
  /** Id of the person using the app. Marked You in the name label and the list. */
  selfId?: string;
  /** Accessible name of the stack button. */
  label?: string;
  /** Heading of the list. */
  heading?: string;
  /** Whether the list of everyone is open. Pass with onOpenChange to control it. */
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Makes each row in the list a button, for example to follow that person's cursor. */
  onPersonSelect?: (person: PresencePerson) => void;
  /** Announces joins and leaves in a polite live region. */
  announce?: boolean;
  className?: string;
  style?: CSSProperties;
}

const SIZES = { sm: 28, md: 36, lg: 44 } as const;
const STATUS_TEXT: Record<PresenceStatus, string> = { active: "Active now", idle: "Idle", typing: "Typing" };

function initialsOf(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map(part => part[0]?.toUpperCase() ?? "").join("");
}

/** A portrait with an initials fallback. The photo is decorative; the name lives on the surrounding element. */
function Face({ person, size }: { person: PresencePerson; size: number }) {
  const [failed, setFailed] = useState<string>();
  const showImage = person.src && failed !== person.src;
  return <span className={styles.face}>
    <span className={styles.initials} aria-hidden="true">{initialsOf(person.name)}</span>
    {showImage ? <ArcImage src={person.src!} alt="" fill sizes={`${size}px`} className={styles.photo} onError={() => setFailed(person.src)} draggable={false} /> : null}
  </span>;
}

/** Three dots that rise in turn. Static with reduced motion. */
function TypingDots({ className }: { className?: string }) {
  return <span className={[styles.dots, className].filter(Boolean).join(" ")} aria-hidden="true"><i /><i /><i /></span>;
}

/** The status mark on an avatar: a dot for active and idle that stretches into a typing indicator while they type. */
function StatusMark({ status, reduceMotion }: { status: PresenceStatus; reduceMotion: boolean }) {
  const swap = reduceMotion ? { duration: 0 } : motionTokens.spring.snappy;
  return <span className={styles.mark} aria-hidden="true">
    <AnimatePresence initial={false} mode="popLayout">
      {status === "typing"
        ? <motion.span key="typing" className={styles.typingMark} initial={{ opacity: 0, scale: .4 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: .4 }} transition={swap}><TypingDots /></motion.span>
        : <motion.span key="dot" className={[styles.dot, status === "idle" ? styles.dotIdle : ""].join(" ")} initial={{ opacity: 0, scale: .4 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: .4 }} transition={swap} />}
    </AnimatePresence>
  </span>;
}

/**
 * Overlapping avatars of the people here now. A person joining pops into their slot while the others slide over to make room;
 * someone leaving shrinks away and the gap closes. Past `max` the rest collapse into a counter that rolls up or down. Hover or
 * focus keeps the stack in place and a name label glides between the faces; click opens a list of everyone with what they are doing.
 */
export function PresenceStack({ people, max = 4, size = "md", align = "start", selfId, label = "People here now", heading = "Here now", open: openProp, defaultOpen = false, onOpenChange, onPersonSelect, announce = true, className, style }: PresenceStackProps) {
  const reduceMotion = !!useReducedMotion();
  const px = SIZES[size];
  const step = Math.round(px * .68);
  const limit = Math.max(1, Math.floor(max));
  const overflowing = people.length > limit;
  const visible = overflowing ? people.slice(0, limit) : people;
  const overflow = people.length - visible.length;
  const slots = visible.length + (overflow > 0 ? 1 : 0);
  const capacity = limit + 1;
  const box = (capacity - 1) * step + px;

  const [openState, setOpenState] = useState(defaultOpen);
  const open = openProp ?? openState;
  const setOpen = (next: boolean) => { if (openProp === undefined) setOpenState(next); onOpenChange?.(next); };

  const [pointing, setPointing] = useState(false);
  const [focused, setFocused] = useState(false);
  const [hovered, setHovered] = useState<number | null>(null);
  const leaveTimer = useRef<number | undefined>(undefined);
  // Hover and focus only name a face; the stack itself never spreads or shifts.
  const engaged = (pointing || focused) && !open;
  const width = slots > 0 ? (slots - 1) * step + px : 0;
  const offset = align === "end" ? box - width : 0;
  const xAt = (index: number) => offset + index * step;

  const enter = (index: number) => { window.clearTimeout(leaveTimer.current); setPointing(true); setHovered(index); };
  const leave = () => { window.clearTimeout(leaveTimer.current); leaveTimer.current = window.setTimeout(() => { setPointing(false); setHovered(null); }, 90); };
  useEffect(() => () => window.clearTimeout(leaveTimer.current), []);

  // Keep the hovered index inside the stack as people come and go.
  const labelIndex = hovered !== null && hovered < slots ? hovered : null;
  const labelTarget = labelIndex === null ? null : labelIndex < visible.length ? visible[labelIndex] : null;
  const labelText = labelTarget ? `${labelTarget.name}${labelTarget.id === selfId ? " (you)" : ""}` : labelIndex !== null ? `${overflow} more` : "";
  const labelSub = labelTarget ? STATUS_TEXT[labelTarget.status ?? "active"] : labelIndex !== null ? "Show everyone" : "";

  // The label's width follows its text on a spring, so moving between faces never snaps.
  const measure = useRef<HTMLSpanElement>(null);
  const labelWidth = useMotionValue(0);
  const labelShown = engaged && labelIndex !== null;
  const wasShown = useRef(false);
  useLayoutEffect(() => {
    if (!measure.current) return;
    const next = measure.current.offsetWidth + 1;
    // A label that is just appearing takes its width at once; one that is already up follows its new text on a spring.
    if (!labelShown || !wasShown.current || reduceMotion) labelWidth.set(next);
    else animate(labelWidth, next, motionTokens.spring.morph);
    wasShown.current = labelShown;
  }, [labelText, labelSub, labelShown, reduceMotion, labelWidth]);

  // The overflow counter rolls the way it moved.
  const [count, setCount] = useState({ value: overflow, direction: 1 });
  if (count.value !== overflow) setCount({ value: overflow, direction: overflow < count.value ? -1 : 1 });

  // Joins and leaves go to a polite live region.
  const [announcement, setAnnouncement] = useState("");
  const previous = useRef(people);
  useEffect(() => {
    if (!announce) return;
    const before = new Map(previous.current.map(person => [person.id, person]));
    const after = new Set(people.map(person => person.id));
    const joined = people.filter(person => !before.has(person.id)).map(person => `${person.name} joined`);
    const left = previous.current.filter(person => !after.has(person.id)).map(person => `${person.name} left`);
    previous.current = people;
    const message = [...joined, ...left].join(". ");
    if (message) setAnnouncement(message);
  }, [people, announce]);

  const move = reduceMotion ? { duration: 0 } : motionTokens.spring.smooth;
  const pop = reduceMotion ? { duration: 0 } : motionTokens.spring.morph;
  const exitFast: Transition = { duration: reduceMotion ? 0 : motionTokens.duration.fast, ease: [...motionTokens.ease.standard] as Transition["ease"] };

  const onKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const delta = event.key === "ArrowRight" ? 1 : -1;
    setHovered(current => current === null ? (delta > 0 ? 0 : slots - 1) : Math.min(slots - 1, Math.max(0, current + delta)));
  };

  const summary = `${label}, ${people.length} ${people.length === 1 ? "person" : "people"}`;

  return <div className={[styles.root, styles[size], className].filter(Boolean).join(" ")} style={{ ...style, "--size": `${px}px` } as CSSProperties} data-align={align}>
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          type="button"
          className={styles.trigger}
          style={{ width: box, height: px }}
          aria-label={summary}
          onFocus={event => { if (event.currentTarget.matches(":focus-visible")) setFocused(true); }}
          onBlur={() => { setFocused(false); setHovered(null); }}
          onKeyDown={onKeyDown}
        >
          <AnimatePresence initial={false}>
            {visible.map((person, index) => {
              const status = person.status ?? "active";
              return <motion.span
                key={person.id}
                className={[styles.avatar, status === "idle" ? styles.idle : ""].join(" ")}
                style={{ zIndex: slots - index }}
                initial={{ x: xAt(index), opacity: 0, scale: .4 }}
                animate={{ x: xAt(index), y: engaged && labelIndex === index ? -2 : 0, opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: .4, transition: exitFast }}
                transition={{ x: move, y: move, scale: pop, opacity: { duration: reduceMotion ? 0 : motionTokens.duration.fast } }}
                onPointerEnter={() => enter(index)}
                onPointerLeave={leave}
              >
                <Face person={person} size={px} />
                <StatusMark status={status} reduceMotion={reduceMotion} />
              </motion.span>;
            })}
            {overflow > 0 ? <motion.span
              key="overflow"
              className={styles.overflow}
              style={{ zIndex: 0 }}
              initial={{ x: xAt(visible.length), opacity: 0, scale: .4 }}
              animate={{ x: xAt(visible.length), y: engaged && labelIndex === visible.length ? -2 : 0, opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: .4, transition: exitFast }}
              transition={{ x: move, y: move, scale: pop }}
              onPointerEnter={() => enter(visible.length)}
              onPointerLeave={leave}
            >
              <motion.span className={styles.countShift} initial={false} animate={{ x: (px - step) / 2 }} transition={move}>
              <AnimatePresence mode="popLayout" initial={false} custom={count.direction}>
                <motion.span
                  key={overflow}
                  className={styles.count}
                  custom={count.direction}
                  initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: `${.55 * count.direction}em` }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: `${-.55 * count.direction}em` }}
                  transition={reduceMotion ? { duration: 0 } : motionTokens.spring.snappy}
                >+{overflow}</motion.span>
              </AnimatePresence>
              </motion.span>
            </motion.span> : null}
          </AnimatePresence>
          <span ref={measure} className={[styles.label, styles.measure].join(" ")} aria-hidden="true"><span className={styles.labelName}>{labelText}</span><span className={styles.labelSub}>{labelSub}</span></span>
          <AnimatePresence>
            {engaged && labelIndex !== null ? <motion.span
              key="label"
              className={styles.labelTrack}
              aria-hidden="true"
              initial={{ x: xAt(labelIndex) + px / 2, opacity: 0, y: -4, scale: .96 }}
              animate={{ x: xAt(labelIndex) + px / 2, opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -4, scale: .96, transition: exitFast }}
              transition={{ x: reduceMotion ? { duration: 0 } : motionTokens.spring.morph, default: reduceMotion ? { duration: 0 } : motionTokens.spring.snappy }}
            >
              <motion.span className={styles.label} style={{ width: labelWidth }}>
                <AnimatePresence mode="popLayout" initial={false}>
                  <motion.span key={labelText} className={styles.labelInner} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: reduceMotion ? 0 : motionTokens.duration.fast }}>
                    <span className={styles.labelName}>{labelText}</span>
                    <span className={styles.labelSub}>{labelTarget?.status === "typing" ? <TypingDots className={styles.labelDots} /> : null}{labelSub}</span>
                  </motion.span>
                </AnimatePresence>
              </motion.span>
            </motion.span> : null}
          </AnimatePresence>
        </button>
      </Popover.Trigger>
      <AnimatePresence>
        {open ? <Popover.Portal forceMount>
          <Popover.Content forceMount asChild align={align} sideOffset={10} collisionPadding={12} aria-label={heading}>
            <motion.div
              className={styles.panel}
              initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -6, scale: .97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={reduceMotion ? { opacity: 0, transition: { duration: 0 } } : { opacity: 0, y: -4, scale: .98, transition: { duration: motionTokens.duration.fast, ease: [...motionTokens.ease.standard] } }}
              transition={reduceMotion ? { duration: 0 } : motionTokens.spring.snappy}
            >
              <div className={styles.panelHead}>
                <span className={styles.panelTitle}>{heading}</span>
                <RollingNumber value={people.length} reduceMotion={reduceMotion} />
              </div>
              <ul className={styles.list}>
                <AnimatePresence initial={false}>
                  {people.map(person => {
                    const status = person.status ?? "active";
                    const you = person.id === selfId;
                    const body = <>
                      <span className={[styles.rowAvatar, status === "idle" ? styles.idle : ""].join(" ")}>
                        <Face person={person} size={28} />
                        <StatusMark status={status} reduceMotion={reduceMotion} />
                      </span>
                      <span className={styles.rowText}>
                        <span className={styles.rowName}>{person.name}{you ? <span className={styles.you}> (you)</span> : null}</span>
                        <span className={styles.rowDetail}>
                          <AnimatePresence mode="popLayout" initial={false}>
                            <motion.span key={`${status}-${person.detail ?? ""}`} className={styles.rowDetailText} initial={{ opacity: 0, y: reduceMotion ? 0 : 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: reduceMotion ? 0 : -4 }} transition={reduceMotion ? { duration: 0 } : motionTokens.spring.snappy}>
                              {status === "typing" ? <TypingDots className={styles.rowDots} /> : null}
                              {person.detail ?? STATUS_TEXT[status]}
                            </motion.span>
                          </AnimatePresence>
                        </span>
                      </span>
                    </>;
                    return <motion.li
                      key={person.id}
                      className={styles.rowWrap}
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={reduceMotion ? { duration: 0 } : motionTokens.spring.smooth}
                    >
                      {onPersonSelect
                        ? <button type="button" className={[styles.row, styles.rowButton].join(" ")} onClick={() => { onPersonSelect(person); setOpen(false); }} aria-label={`${person.name}${you ? " (you)" : ""}, ${person.detail ?? STATUS_TEXT[status]}`}>{body}</button>
                        : <div className={styles.row}>{body}</div>}
                    </motion.li>;
                  })}
                </AnimatePresence>
              </ul>
              {people.length === 0 ? <p className={styles.empty}>No one else is here right now</p> : null}
            </motion.div>
          </Popover.Content>
        </Popover.Portal> : null}
      </AnimatePresence>
    </Popover.Root>
    <span className={styles.srOnly} role="status" aria-live="polite">{announcement}</span>
  </div>;
}

/** A count that rolls up when it grows and down when it shrinks, on tabular figures. */
function RollingNumber({ value, reduceMotion }: { value: number; reduceMotion: boolean }) {
  const [state, setState] = useState({ value, direction: 1 });
  if (state.value !== value) setState({ value, direction: value < state.value ? -1 : 1 });
  const id = useId();
  return <span className={styles.panelCount} aria-label={`${value} ${value === 1 ? "person" : "people"}`} id={id}>
    <AnimatePresence mode="popLayout" initial={false}>
      <motion.span key={value} aria-hidden="true" initial={{ opacity: 0, y: reduceMotion ? 0 : `${.6 * state.direction}em` }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: reduceMotion ? 0 : `${-.6 * state.direction}em` }} transition={reduceMotion ? { duration: 0 } : motionTokens.spring.snappy}>{value}</motion.span>
    </AnimatePresence>
  </span>;
}

export default PresenceStack;
