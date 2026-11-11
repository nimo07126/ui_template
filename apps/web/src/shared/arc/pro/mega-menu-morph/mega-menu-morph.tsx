"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import type { CSSProperties, FocusEvent as ReactFocusEvent, KeyboardEvent as ReactKeyboardEvent, MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent, ReactNode } from "react";
import { AnimatePresence, animate, motion, useIsPresent, useMotionTemplate, useMotionValue, useReducedMotion } from "motion/react";
import type { MotionValue, Transition, Variants } from "motion/react";
import {
  Activity, ArrowRight, BookOpen, Briefcase, Building2, ChevronDown, CreditCard, FileText, Heart, Layers, Menu, Newspaper,
  Package, Repeat, Rocket, Send, ShieldCheck, ShoppingBag, Store, SquareTerminal, Users, Webhook, X, Zap,
} from "lucide-react";
import { motionTokens } from "../../lib/motion-tokens";
import styles from "./mega-menu-morph.module.css";

/** One destination inside a menu. */
export interface MegaMenuLink {
  label: string;
  /** One short line under the label. */
  description?: string;
  /** Plain decorative icon beside the label, 16 to 18px. */
  icon?: ReactNode;
  href?: string;
  /** A short neutral tag after the label, such as New or 12 open roles. */
  badge?: string;
}

/** A titled column of links. */
export interface MegaMenuGroup {
  title?: string;
  links: MegaMenuLink[];
}

/** A highlighted story beside the link columns. */
export interface MegaMenuFeature {
  title: string;
  description?: string;
  /** Label of the link at the bottom of the card. */
  cta?: string;
  href?: string;
  /** Optional media above the title, such as an image. */
  media?: ReactNode;
}

/** A top level section. Items with groups open a menu; items without groups are plain links. */
export interface MegaMenuItem {
  /** Stable value, used for value, defaultValue and current. */
  value: string;
  label: string;
  href?: string;
  groups?: MegaMenuGroup[];
  feature?: MegaMenuFeature;
  /** A slim row along the bottom of the menu, drawn on a muted band that morphs with the panel. */
  footer?: ReactNode;
}

export interface MegaMenuAction {
  label: string;
  href?: string;
  onClick?: () => void;
  /** The primary action is filled; quiet actions are text. Defaults to quiet. */
  variant?: "primary" | "quiet";
}

/** What onNavigate receives. */
export interface MegaMenuDestination {
  label: string;
  href?: string;
  /** Value of the section the destination belongs to, when there is one. */
  section?: string;
}

/**
 * A site header whose menus share one floating surface. Moving between sections morphs the surface to the next menu's
 * size, slides the content in from the side you came from and glides the caret under the new trigger, instead of closing
 * one menu and opening another. A highlight follows the pointer across the triggers, hover intent and a safe triangle keep
 * diagonal moves toward the menu from switching sections, and narrow headers fold into an accordion sheet.
 */
export interface MegaMenuMorphProps {
  /** Sections of the header. Defaults to a sample payments company. */
  items?: MegaMenuItem[];
  brand?: { name: string; mark?: ReactNode; href?: string };
  /** Actions at the end of the header, such as Sign in and a primary call to action. */
  actions?: MegaMenuAction[];
  /** The open menu, controlled. null keeps every menu closed. */
  value?: string | null;
  /** The menu open on first render, uncontrolled. */
  defaultValue?: string | null;
  /** Called with the menu that should open, or null when menus close. */
  onValueChange?: (value: string | null) => void;
  /** Value of the section that holds the current page. It carries a small accent mark. */
  current?: string;
  /** How long the pointer rests on a trigger before the first menu opens, in ms. */
  openDelay?: number;
  /** How long the menu waits after the pointer leaves the header and the menu before closing, in ms. */
  closeDelay?: number;
  /** Below this header width in px the sections fold into an accordion sheet. "auto" folds as soon as the full row stops fitting. */
  collapseBelow?: number | "auto";
  /** Draws the safe triangle between the pointer and the menu. A development aid for tuning hover behavior. */
  showSafeArea?: boolean;
  /** Called for every destination: links, feature cards, plain sections, actions and the brand. */
  onNavigate?: (destination: MegaMenuDestination) => void;
  /** Accessible name of the navigation landmark. */
  label?: string;
  className?: string;
  style?: CSSProperties;
}

const icon = (Icon: typeof Activity) => <Icon aria-hidden="true" />;

export const megaMenuSampleItems: MegaMenuItem[] = [
  {
    value: "products", label: "Products",
    groups: [
      { title: "Payments", links: [
        { label: "Checkout", description: "Hosted pages in 46 currencies", icon: icon(CreditCard), href: "#checkout" },
        { label: "Billing", description: "Subscriptions, usage and invoices", icon: icon(Repeat), href: "#billing" },
        { label: "Terminal", description: "In person payments on any reader", icon: icon(Store), href: "#terminal" },
      ] },
      { title: "Operations", links: [
        { label: "Payouts", description: "Pay sellers and contractors daily", icon: icon(Send), href: "#payouts", badge: "New" },
        { label: "Risk", description: "Fraud scoring trained on your traffic", icon: icon(ShieldCheck), href: "#risk" },
        { label: "Reports", description: "Reconcile every payout to the cent", icon: icon(FileText), href: "#reports" },
      ] },
    ],
    feature: { title: "Instant payouts in the EU", description: "Sellers in 27 countries now get paid in seconds, weekends included.", cta: "Read the announcement", href: "#instant-payouts" },
  },
  {
    value: "solutions", label: "Solutions",
    groups: [
      { title: "By stage", links: [
        { label: "Startups", icon: icon(Rocket), href: "#startups" },
        { label: "Enterprises", icon: icon(Building2), href: "#enterprises" },
        { label: "Platforms", icon: icon(Layers), href: "#platforms" },
      ] },
      { title: "By industry", links: [
        { label: "Software", icon: icon(Package), href: "#software" },
        { label: "Marketplaces", icon: icon(Users), href: "#marketplaces" },
        { label: "Retail", icon: icon(ShoppingBag), href: "#retail" },
      ] },
    ],
  },
  {
    value: "developers", label: "Developers",
    groups: [
      { title: "Documentation", links: [
        { label: "Quickstart", description: "Take a first payment in 10 minutes", icon: icon(Zap), href: "#quickstart" },
        { label: "API reference", description: "Every endpoint, with live examples", icon: icon(BookOpen), href: "#api" },
      ] },
      { title: "Tools", links: [
        { label: "CLI", description: "Replay webhooks from your terminal", icon: icon(SquareTerminal), href: "#cli" },
        { label: "Webhooks", description: "Signed events with automatic retries", icon: icon(Webhook), href: "#webhooks" },
      ] },
    ],
    footer: <span className={styles.status}><span className={styles.statusDot} aria-hidden="true" />All systems normal<span className={styles.statusMeta}>API uptime 99.998% over 90 days</span></span>,
  },
  {
    value: "company", label: "Company",
    groups: [
      { links: [
        { label: "About", icon: icon(Heart), href: "#about" },
        { label: "Customers", icon: icon(Users), href: "#customers" },
        { label: "Careers", icon: icon(Briefcase), href: "#careers", badge: "12 open roles" },
        { label: "Press", icon: icon(Newspaper), href: "#press" },
      ] },
    ],
    footer: <span className={styles.footerNote}>Offices in Zurich, Lisbon and New York</span>,
  },
  { value: "pricing", label: "Pricing", href: "#pricing" },
];

const sampleActions: MegaMenuAction[] = [{ label: "Sign in", href: "#sign-in" }, { label: "Start now", href: "#start", variant: "primary" }];
const sampleBrand = { name: "Tally", href: "#home", mark: <svg viewBox="0 0 20 20" aria-hidden="true"><rect x="2" y="2" width="16" height="16" rx="5" fill="currentColor" /><path d="M6.5 7.5h7M10 7.5v6" stroke="var(--arc-background)" strokeWidth="1.9" strokeLinecap="round" /></svg> };

type Bezier = [number, number, number, number];
const standard = [...motionTokens.ease.standard] as Bezier;
/** Duration based springs restated as stiffness and damping, so a retarget mid flight keeps the velocity it already has. */
const physical = (visualDuration: number, bounce: number): Transition => {
  const root = 2 * Math.PI / (visualDuration * 1.2);
  return { type: "spring", stiffness: root * root, damping: 2 * (1 - bounce) * root, mass: 1 };
};
/** Growing carries a trace of overshoot; shrinking never overshoots. The caret and the position glide together. */
const GROW = physical(.42, 0), SHRINK = physical(.36, 0), GLIDE = physical(.4, 0), HIGHLIGHT = physical(.32, 0), SLIDE = physical(.42, 0);
const TRAVEL = 36, INSET = 8, GAP = 10, CARET_MIN = 26;
/** How long a pointer that is heading into the open menu may cross another trigger before that trigger takes over. */
const AIM_HOLD = 320;

const faceVariants: Variants = {
  hidden: (direction: number) => ({ opacity: 0, x: direction * TRAVEL, filter: `blur(${motionTokens.blur.subtle}px)` }),
  shown: { opacity: 1, x: 0, filter: "blur(0px)", transition: { x: SLIDE, opacity: { duration: motionTokens.duration.standard, ease: standard, delay: .05 }, filter: { duration: motionTokens.duration.standard, ease: standard, delay: .05 } } },
  gone: (direction: number) => ({ opacity: 0, x: direction * -TRAVEL * .6, filter: `blur(${motionTokens.blur.subtle}px)`, transition: { x: SLIDE, opacity: { duration: motionTokens.duration.fast, ease: standard }, filter: { duration: motionTokens.duration.fast, ease: standard } } }),
};
const fadeVariants: Variants = { hidden: { opacity: 0 }, shown: { opacity: 1, transition: { duration: .14 } }, gone: { opacity: 0, transition: { duration: .1 } } };

const subscribe = () => () => {};
function useReducedFlag() {
  const hydrated = useSyncExternalStore(subscribe, () => true, () => false);
  return !!useReducedMotion() && hydrated;
}

/** Wall clock for pointer intent timing, read only inside event handlers and timers. */
const clock = () => performance.now();
const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), Math.max(min, max));
const hasMenu = (item: MegaMenuItem) => !!(item.groups?.length || item.feature);

type Size = { w: number; h: number; footer: number };
type Point = { x: number; y: number; t: number };

/** Is point p inside triangle abc, with a little slack for the pointer's own jitter. */
function inTriangle(p: { x: number; y: number }, a: { x: number; y: number }, b: { x: number; y: number }, c: { x: number; y: number }) {
  const sign = (p1: typeof p, p2: typeof p, p3: typeof p) => (p1.x - p3.x) * (p2.y - p3.y) - (p2.x - p3.x) * (p1.y - p3.y);
  const d1 = sign(p, a, b), d2 = sign(p, b, c), d3 = sign(p, c, a);
  const negative = d1 < -1 || d2 < -1 || d3 < -1, positive = d1 > 1 || d2 > 1 || d3 > 1;
  return !(negative && positive);
}

/** A menu reports its natural size while it is the current one. A leaving menu turns inert and stops reporting. */
function Face({ id, direction, reduced, onSize, active, children }: { id: string; direction: number; reduced: boolean; active: boolean; onSize: (id: string, size: Size) => void; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const present = useIsPresent();
  useLayoutEffect(() => {
    const node = ref.current;
    if (!node || !present) return;
    const report = () => {
      // The face stretches to the surface's height mid spring, so its natural height is its body plus its footer.
      const body = node.querySelector<HTMLElement>("[data-mm-body]");
      const footer = node.querySelector<HTMLElement>("[data-mm-footer]");
      const footerHeight = footer?.offsetHeight ?? 0;
      onSize(id, { w: node.offsetWidth, h: (body?.offsetHeight ?? 0) + footerHeight, footer: footerHeight });
    };
    report();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(report);
    for (const child of Array.from(node.children)) observer.observe(child);
    return () => observer.disconnect();
  }, [id, onSize, present]);
  return <motion.div ref={ref} className={styles.face} custom={direction} variants={reduced ? fadeVariants : faceVariants}
    initial="hidden" animate="shown" exit="gone" inert={!present || undefined} data-mm-active={active && present ? "" : undefined}>{children}</motion.div>;
}

function MenuContent({ item, onPick }: { item: MegaMenuItem; onPick: (event: ReactMouseEvent, destination: MegaMenuDestination) => void }) {
  const { feature } = item;
  return <>
    <div className={styles.faceBody} data-mm-body="">
      {item.groups?.map((group, index) => <div key={group.title ?? index} className={styles.group}>
        {group.title ? <p className={styles.groupTitle}>{group.title}</p> : null}
        <ul className={styles.links} data-dense={group.links.every(link => !link.description) || undefined}>
          {group.links.map(link => <li key={link.label}>
            <a className={styles.link} href={link.href ?? "#"} data-mm-link="" onClick={event => onPick(event, { label: link.label, href: link.href, section: item.value })}>
              {link.icon ? <span className={styles.linkIcon}>{link.icon}</span> : null}
              <span className={styles.linkText}>
                <span className={styles.linkLabel}>{link.label}{link.badge ? <span className={styles.badge}>{link.badge}</span> : null}</span>
                {link.description ? <span className={styles.linkDescription}>{link.description}</span> : null}
              </span>
            </a>
          </li>)}
        </ul>
      </div>)}
      {feature ? <a className={styles.feature} href={feature.href ?? "#"} data-mm-link="" onClick={event => onPick(event, { label: feature.title, href: feature.href, section: item.value })}>
        {feature.media ? <span className={styles.featureMedia}>{feature.media}</span> : <span className={styles.featureArt} aria-hidden="true"><span /><span /><span /></span>}
        <span className={styles.featureTitle}>{feature.title}</span>
        {feature.description ? <span className={styles.featureDescription}>{feature.description}</span> : null}
        {feature.cta ? <span className={styles.featureCta}>{feature.cta}<ArrowRight aria-hidden="true" /></span> : null}
      </a> : null}
    </div>
    {item.footer ? <div className={styles.faceFooter} data-mm-footer="">{item.footer}</div> : null}
  </>;
}

function useControllable<T>(value: T | undefined, defaultValue: T, onChange?: (next: T) => void) {
  const [inner, setInner] = useState(defaultValue);
  const controlled = value !== undefined;
  const current = controlled ? value : inner;
  const set = useCallback((next: T) => {
    if (!controlled) setInner(next);
    onChange?.(next);
  }, [controlled, onChange]);
  return [current, set] as const;
}

export function MegaMenuMorph({
  items = megaMenuSampleItems, brand = sampleBrand, actions = sampleActions, value, defaultValue = null, onValueChange, current,
  openDelay = 90, closeDelay = 240, collapseBelow = "auto", showSafeArea = false, onNavigate, label = "Main", className, style,
}: MegaMenuMorphProps) {
  const reduced = useReducedFlag();
  const uid = useId();
  const [open, setOpenValue] = useControllable<string | null>(value, defaultValue, onValueChange);
  const [hot, setHot] = useState<string | null>(null);
  const [direction, setDirection] = useState(0);
  const [collapsed, setCollapsed] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [section, setSection] = useState<string | null>(null);

  const rootRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const safeRef = useRef<SVGPolygonElement>(null);
  const itemRefs = useRef(new Map<string, HTMLElement>());
  const sizes = useRef(new Map<string, Size>());
  const openRef = useRef(open);
  const shownRef = useRef(false);
  const timers = useRef<{ open?: number; close?: number; aim?: number }>({});
  const trail = useRef<Point[]>([]);
  const openedByHoverAt = useRef(0);
  const focusFirst = useRef(false);
  const enteredAt = useRef(-Infinity);
  const collapsedRef = useRef(false);
  const hotRef = useRef<string | null>(null);
  const setHotValue = (next: string | null) => { hotRef.current = next; setHot(next); };

  const px = useMotionValue(0), pw = useMotionValue(0), ph = useMotionValue(0), bh = useMotionValue(0), cx = useMotionValue(0);
  const hx = useMotionValue(0), hw = useMotionValue(0), ho = useMotionValue(0);
  const origin = useMotionTemplate`${cx}px 0px`;

  const menuItems = items.filter(hasMenu);
  const indexOf = (next: string | null) => items.findIndex(item => item.value === next);

  const clearTimer = (name: "open" | "close" | "aim") => { window.clearTimeout(timers.current[name]); timers.current[name] = undefined; };
  useEffect(() => () => { const t = timers.current; window.clearTimeout(t.open); window.clearTimeout(t.close); window.clearTimeout(t.aim); }, []);

  /** Positions the surface under a trigger. From closed it lands in place; between menus every edge springs. */
  const place = useCallback((next: string, jump: boolean) => {
    const root = rootRef.current, trigger = itemRefs.current.get(next), size = sizes.current.get(next);
    if (!root || !trigger || !size) return;
    const width = root.clientWidth;
    const w = Math.min(size.w, width - INSET * 2);
    const center = trigger.offsetLeft + (trackRef.current?.offsetLeft ?? 0) + trigger.offsetWidth / 2;
    const x = clamp(center - w / 2, INSET, width - INSET - w);
    const caret = clamp(center - x, CARET_MIN, w - CARET_MIN);
    if (jump) enteredAt.current = clock();
    // While the surface is still fading in it lands in place instead of springing. A freshly mounted surface can also be handed its
    // first style values again as it attaches (React replays effects in development), so the entrance re-lands on the next frame.
    const entering = clock() - enteredAt.current < 200;
    if (jump || entering || reduced) {
      const values = [[px, x], [pw, w], [ph, size.h], [bh, size.footer], [cx, caret]] as [MotionValue<number>, number][];
      const land = () => { for (const [mv, target] of values) { mv.stop(); mv.set(target); } };
      land();
      if (jump) requestAnimationFrame(() => { if (openRef.current === next && pw.get() !== w) land(); });
      return;
    }
    animate(pw, w, w >= pw.get() ? GROW : SHRINK);
    const heightSpring = size.h >= ph.get() ? GROW : SHRINK;
    animate(ph, size.h, heightSpring);
    animate(bh, size.footer, heightSpring);
    animate(px, x, GLIDE);
    animate(cx, caret, GLIDE);
  }, [bh, cx, ph, pw, px, reduced]);

  const onSize = useCallback((id: string, size: Size) => {
    sizes.current.set(id, size);
    if (openRef.current !== id) return;
    place(id, !shownRef.current);
    shownRef.current = true;
  }, [place]);

  const setOpen = useCallback((next: string | null) => {
    const previous = openRef.current;
    if (next === previous) return;
    if (next && previous) setDirection(Math.sign(indexOf(next) - indexOf(previous)));
    else setDirection(0);
    openRef.current = next;
    setOpenValue(next);
    // A remount measures again; a menu seen before places at once from its cached size.
    if (next && sizes.current.has(next)) { place(next, !shownRef.current); shownRef.current = true; }
    // indexOf reads items, which is stable for the lifetime of a render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [place, setOpenValue, items]);

  const setOpenRef = useRef(setOpen);
  useLayoutEffect(() => { setOpenRef.current = setOpen; });

  // Keep the ref in step when the value is controlled from outside.
  useLayoutEffect(() => {
    if (openRef.current === open) return;
    const previous = openRef.current;
    openRef.current = open;
    if (open && previous) setDirection(Math.sign(indexOf(open) - indexOf(previous)));
    if (open && sizes.current.has(open)) { place(open, !shownRef.current); shownRef.current = true; }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  /* Highlight: glides between triggers; appears in place when it was hidden, and fades where it is when the pointer leaves. */
  const highlightTarget = hot ?? (collapsed ? null : open);
  useLayoutEffect(() => {
    const node = highlightTarget ? itemRefs.current.get(highlightTarget) : undefined;
    if (!node) { animate(ho, 0, { duration: .18, ease: standard }); return; }
    const visible = ho.get() > .35;
    if (!visible || reduced) {
      hx.stop(); hw.stop(); hx.set(node.offsetLeft); hw.set(node.offsetWidth);
      animate(ho, 1, { duration: reduced ? 0 : .16, ease: standard });
      return;
    }
    animate(ho, 1, { duration: .12, ease: standard });
    animate(hx, node.offsetLeft, HIGHLIGHT);
    animate(hw, node.offsetWidth, HIGHLIGHT);
  }, [highlightTarget, collapsed, reduced, ho, hw, hx]);

  /* Fold into the sheet when the full row stops fitting, measured from an invisible copy of the row at its natural width. */
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const measure = () => {
      const width = root.clientWidth;
      const natural = measureRef.current?.offsetWidth ?? 0;
      const next = collapseBelow === "auto" ? natural > width : width < collapseBelow;
      if (next !== collapsedRef.current) {
        // Crossing the fold closes whatever was open on the other side.
        collapsedRef.current = next;
        setCollapsed(next);
        setHot(null);
        if (next) setOpenRef.current(null); else setSheetOpen(false);
      } else if (openRef.current) place(openRef.current, true);
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(root);
    if (measureRef.current) observer.observe(measureRef.current);
    return () => observer.disconnect();
  }, [collapseBelow, place]);


  /* Pointer intent. */
  const scheduleClose = (delay = closeDelay) => {
    clearTimer("open"); clearTimer("aim");
    if (!openRef.current || timers.current.close) return;
    timers.current.close = window.setTimeout(() => { timers.current.close = undefined; setOpen(null); }, delay);
  };
  const cancelClose = () => clearTimer("close");

  /** True while the pointer travels from where it was toward the open menu, inside the triangle to its top corners. */
  const aimingAtMenu = () => {
    const panel = panelRef.current, root = rootRef.current;
    const points = trail.current;
    if (!panel || !root || points.length < 2) return false;
    const now = points[points.length - 1];
    const from = points.find(point => now.t - point.t < 120) ?? points[0];
    if (Math.hypot(now.x - from.x, now.y - from.y) < 3) return false;
    const rect = panel.getBoundingClientRect();
    const corners = [{ x: rect.left - 4, y: rect.top }, { x: rect.right + 4, y: rect.top }];
    return now.y >= from.y - 1 && inTriangle(now, from, corners[0], corners[1]);
  };

  const drawSafeArea = () => {
    const polygon = safeRef.current, panel = panelRef.current, root = rootRef.current;
    const points = trail.current;
    if (!polygon || !root) return;
    if (!panel || !openRef.current || !points.length) { polygon.setAttribute("points", ""); return; }
    const box = root.getBoundingClientRect(), rect = panel.getBoundingClientRect();
    const now = points[points.length - 1];
    const from = points.find(point => now.t - point.t < 120) ?? now;
    polygon.setAttribute("points", `${from.x - box.left},${from.y - box.top} ${rect.left - 4 - box.left},${rect.top - box.top} ${rect.right + 4 - box.left},${rect.top - box.top}`);
    polygon.dataset.aiming = aimingAtMenu() ? "true" : "false";
  };

  const onRootPointerMove = (event: ReactPointerEvent) => {
    if (event.pointerType !== "mouse" && event.pointerType !== "pen") return;
    const points = trail.current;
    points.push({ x: event.clientX, y: event.clientY, t: event.timeStamp });
    while (points.length > 12 || (points.length > 2 && event.timeStamp - points[0].t > 240)) points.shift();
    if (showSafeArea) drawSafeArea();
  };

  const switchTo = (next: string) => {
    clearTimer("aim");
    const attempt = (started: number) => {
      if (openRef.current === next || hotRef.current !== next) return;
      const waited = clock() - started;
      if (aimingAtMenu() && waited < AIM_HOLD) { timers.current.aim = window.setTimeout(() => attempt(started), 60); return; }
      setOpen(next);
    };
    attempt(clock());
  };

  const onItemEnter = (item: MegaMenuItem, event: ReactPointerEvent) => {
    if (event.pointerType === "touch") return;
    setHotValue(item.value);
    cancelClose();
    if (!hasMenu(item)) { if (openRef.current) scheduleClose(150); return; }
    if (openRef.current) { switchTo(item.value); return; }
    clearTimer("open");
    timers.current.open = window.setTimeout(() => {
      timers.current.open = undefined;
      openedByHoverAt.current = clock();
      setOpen(item.value);
    }, openDelay);
  };
  const onItemLeave = (item: MegaMenuItem) => {
    if (hotRef.current === item.value) setHotValue(null);
    if (!openRef.current) clearTimer("open");
  };

  const onTriggerClick = (item: MegaMenuItem, event: ReactMouseEvent) => {
    clearTimer("open"); cancelClose();
    const mouse = event.detail > 0 && hotRef.current === item.value;
    // A hover that opened the menu a moment ago would otherwise be undone by the click that follows it.
    if (openRef.current === item.value && mouse && clock() - openedByHoverAt.current < 450) return;
    setOpen(openRef.current === item.value ? null : item.value);
  };

  const pick = (event: ReactMouseEvent, destination: MegaMenuDestination) => {
    if (onNavigate) { event.preventDefault(); onNavigate(destination); }
    clearTimer("open"); clearTimer("close"); clearTimer("aim");
    setOpen(null);
    setSheetOpen(false);
  };

  /* Keyboard. */
  const barItems = () => items.map(item => itemRefs.current.get(item.value)).filter((node): node is HTMLElement => !!node);
  const panelLinks = () => Array.from(panelRef.current?.querySelectorAll<HTMLElement>("[data-mm-active] [data-mm-link]") ?? []);

  const focusPanel = (which: "first" | "last") => {
    const links = panelLinks();
    if (links.length) { (which === "first" ? links[0] : links[links.length - 1]).focus(); return true; }
    return false;
  };

  // A menu opened from the keyboard moves focus into itself once its links exist.
  useEffect(() => {
    if (!open || !focusFirst.current) return;
    const frame = requestAnimationFrame(() => { if (focusFirst.current && focusPanel("first")) focusFirst.current = false; });
    return () => cancelAnimationFrame(frame);
  });

  const onBarKeyDown = (event: ReactKeyboardEvent, item: MegaMenuItem) => {
    const list = barItems();
    const index = list.indexOf(event.currentTarget as HTMLElement);
    const moveTo = (nextIndex: number) => {
      const node = list[(nextIndex + list.length) % list.length];
      node?.focus();
      const nextItem = items.find(entry => itemRefs.current.get(entry.value) === node);
      if (openRef.current && nextItem) setOpen(hasMenu(nextItem) ? nextItem.value : null);
    };
    switch (event.key) {
      case "ArrowRight": event.preventDefault(); moveTo(index + 1); break;
      case "ArrowLeft": event.preventDefault(); moveTo(index - 1); break;
      case "Home": event.preventDefault(); moveTo(0); break;
      case "End": event.preventDefault(); moveTo(list.length - 1); break;
      case "ArrowDown":
        if (!hasMenu(item)) break;
        event.preventDefault();
        focusFirst.current = true;
        if (openRef.current !== item.value) setOpen(item.value); else focusPanel("first");
        break;
      case "Tab":
        if (!event.shiftKey && openRef.current === item.value && hasMenu(item)) { event.preventDefault(); focusPanel("first"); }
        break;
      case "Escape":
        if (openRef.current) { event.preventDefault(); setOpen(null); }
        break;
    }
  };

  const onPanelKeyDown = (event: ReactKeyboardEvent) => {
    const links = panelLinks();
    const index = links.indexOf(document.activeElement as HTMLElement);
    const trigger = openRef.current ? itemRefs.current.get(openRef.current) : undefined;
    const move = (next: number) => { event.preventDefault(); links[clamp(next, 0, links.length - 1)]?.focus(); };
    switch (event.key) {
      case "ArrowDown": move(index + 1); break;
      case "ArrowUp": if (index <= 0) { event.preventDefault(); trigger?.focus(); } else move(index - 1); break;
      case "Home": move(0); break;
      case "End": move(links.length - 1); break;
      case "ArrowRight":
      case "ArrowLeft": {
        event.preventDefault();
        const step = event.key === "ArrowRight" ? 1 : -1;
        const at = menuItems.findIndex(item => item.value === openRef.current);
        const next = menuItems[(at + step + menuItems.length) % menuItems.length];
        if (!next) break;
        focusFirst.current = true;
        setOpen(next.value);
        break;
      }
      case "Escape": event.preventDefault(); setOpen(null); trigger?.focus(); break;
      case "Tab": {
        if (event.shiftKey && index === 0) { event.preventDefault(); trigger?.focus(); break; }
        if (!event.shiftKey && index === links.length - 1) {
          event.preventDefault();
          const list = barItems();
          const after = trigger ? list[list.indexOf(trigger) + 1] : undefined;
          setOpen(null);
          (after ?? trigger)?.focus();
        }
        break;
      }
    }
  };

  const onRootBlur = (event: ReactFocusEvent) => {
    const next = event.relatedTarget as Node | null;
    if (next && rootRef.current?.contains(next)) return;
    if (openRef.current && next) setOpen(null);
  };

  // Escape and outside presses close the sheet and the menu from anywhere on the page.
  useEffect(() => {
    if (!open && !sheetOpen) return;
    const onDown = (event: PointerEvent) => {
      if (rootRef.current?.contains(event.target as Node)) return;
      setOpen(null); setSheetOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || !sheetOpen) return;
      setSheetOpen(false);
      rootRef.current?.querySelector<HTMLElement>("[data-mm-toggle]")?.focus();
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("pointerdown", onDown); document.removeEventListener("keydown", onKey); };
  }, [open, sheetOpen, setOpen]);

  const openItem = items.find(item => item.value === open && hasMenu(item));
  const panelId = `${uid}-menu`;
  const setItemRef = (key: string) => (node: HTMLElement | null) => { if (node) itemRefs.current.set(key, node); else itemRefs.current.delete(key); };

  const brandNode = (measure: boolean) => <a className={styles.brand} href={brand.href ?? "#"} tabIndex={measure ? -1 : undefined}
    onClick={event => { if (!measure) pick(event, { label: brand.name, href: brand.href }); }}>
    {brand.mark ? <span className={styles.brandMark}>{brand.mark}</span> : null}
    <span className={styles.brandName}>{brand.name}</span>
  </a>;
  const actionNodes = (measure: boolean, list = actions) => list.map(action => <a key={action.label} className={action.variant === "primary" ? styles.primary : styles.quiet}
    href={action.href ?? "#"} tabIndex={measure ? -1 : undefined}
    onPointerEnter={measure ? undefined : () => scheduleClose()}
    onClick={event => { if (measure) return; action.onClick?.(); pick(event, { label: action.label, href: action.href }); }}>{action.label}</a>);

  const primary = actions.filter(action => action.variant === "primary");

  return <div ref={rootRef} className={[styles.root, className].filter(Boolean).join(" ")} style={style}
    data-collapsed={collapsed || undefined} data-open={(openItem && !collapsed) || sheetOpen || undefined}
    onPointerMove={onRootPointerMove} onPointerLeave={event => { if (event.pointerType !== "touch") { setHotValue(null); scheduleClose(); } }}
    onPointerEnter={cancelClose} onBlur={onRootBlur}>
    <nav className={styles.bar} aria-label={label}>
      {brandNode(false)}
      {!collapsed ? <>
        <div ref={trackRef} className={styles.track} onPointerLeave={() => setHotValue(null)}>
          <motion.span className={styles.highlight} aria-hidden="true" style={{ x: hx, width: hw, opacity: ho }} />
          <ul className={styles.items}>
            {items.map(item => {
              const menu = hasMenu(item);
              const isOpen = open === item.value && menu;
              const common = {
                ref: setItemRef(item.value),
                className: styles.item,
                "data-hot": hot === item.value || isOpen || undefined,
                "data-current": current === item.value || undefined,
                onPointerEnter: (event: ReactPointerEvent) => onItemEnter(item, event),
                onPointerLeave: () => onItemLeave(item),
                onFocus: () => setHotValue(item.value),
                onBlur: () => { if (hotRef.current === item.value) setHotValue(null); },
                onKeyDown: (event: ReactKeyboardEvent) => onBarKeyDown(event, item),
              };
              return <li key={item.value}>
                {menu
                  ? <button type="button" {...common} aria-expanded={isOpen} aria-controls={isOpen ? panelId : undefined} onClick={event => onTriggerClick(item, event)}>
                    {item.label}<ChevronDown className={styles.chevron} aria-hidden="true" />
                  </button>
                  : <a {...common} href={item.href ?? "#"} aria-current={current === item.value ? "page" : undefined}
                    onClick={event => pick(event, { label: item.label, href: item.href, section: item.value })}>{item.label}</a>}
              </li>;
            })}
          </ul>
        </div>
        <div className={styles.actions} onPointerEnter={() => scheduleClose()}>{actionNodes(false)}</div>
      </> : <div className={styles.actions}>
        {actionNodes(false, primary)}
        <button type="button" className={styles.toggle} data-mm-toggle="" aria-expanded={sheetOpen} aria-controls={`${uid}-sheet`}
          aria-label={sheetOpen ? "Close menu" : "Open menu"} onClick={() => setSheetOpen(!sheetOpen)}>
          <AnimatePresence initial={false} mode="popLayout">
            <motion.span key={sheetOpen ? "close" : "open"} className={styles.toggleIcon}
              initial={reduced ? { opacity: 0 } : { opacity: 0, rotate: sheetOpen ? -45 : 45, scale: .7 }}
              animate={{ opacity: 1, rotate: 0, scale: 1 }}
              exit={reduced ? { opacity: 0 } : { opacity: 0, rotate: sheetOpen ? 45 : -45, scale: .7 }}
              transition={reduced ? { duration: .1 } : motionTokens.spring.snappy}>
              {sheetOpen ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
            </motion.span>
          </AnimatePresence>
        </button>
      </div>}
    </nav>

    {/* The natural width of the full row, for folding. Invisible and inert. */}
    <div ref={measureRef} className={styles.measure} aria-hidden="true" inert>
      {brandNode(true)}
      <ul className={styles.items}>{items.map(item => <li key={item.value}><span className={styles.item}>{item.label}{hasMenu(item) ? <ChevronDown className={styles.chevron} /> : null}</span></li>)}</ul>
      <div className={styles.actions}>{actionNodes(true)}</div>
    </div>

    <AnimatePresence onExitComplete={() => { shownRef.current = false; }}>
      {openItem && !collapsed ? <motion.div key="panel" ref={panelRef} id={panelId} className={styles.panel}
        style={{ x: px, width: pw, height: ph, transformOrigin: origin, top: `calc(var(--mm-bar-h) + ${GAP}px)` }}
        initial={reduced ? { opacity: 0 } : { opacity: 0, y: -6, scale: .97 }}
        animate={{ opacity: 1, y: 0, scale: 1, transition: reduced ? { duration: .12 } : { opacity: { duration: motionTokens.duration.fast, ease: standard }, default: SLIDE } }}
        exit={reduced ? { opacity: 0, transition: { duration: .1 } } : { opacity: 0, y: -4, scale: .985, transition: { duration: motionTokens.duration.exit, ease: standard } }}
        onPointerEnter={cancelClose} onKeyDown={onPanelKeyDown}>
        <div className={styles.surface} aria-hidden="true">
          <motion.div className={styles.band} style={{ height: bh }} />
        </div>
        <motion.span className={styles.caret} aria-hidden="true" style={{ x: cx }} />
        <div className={styles.clip}>
          <AnimatePresence initial={false} custom={direction}>
            <Face key={openItem.value} id={openItem.value} direction={direction} reduced={reduced} onSize={onSize} active>
              <MenuContent item={openItem} onPick={pick} />
            </Face>
          </AnimatePresence>
        </div>
      </motion.div> : null}
    </AnimatePresence>

    {showSafeArea && !collapsed ? <svg className={styles.safeArea} aria-hidden="true"><polygon ref={safeRef} points="" /></svg> : null}

    <AnimatePresence>
      {collapsed && sheetOpen ? <motion.div key="sheet" id={`${uid}-sheet`} className={styles.sheet}
        initial={reduced ? { opacity: 0 } : { opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
        exit={reduced ? { opacity: 0 } : { opacity: 0, height: 0 }}
        transition={reduced ? { duration: .12 } : { height: motionTokens.spring.smooth, opacity: { duration: .18, ease: standard } }}>
        <motion.ul className={styles.sheetList} initial="hidden" animate="shown"
          variants={{ hidden: {}, shown: { transition: { staggerChildren: reduced ? 0 : motionTokens.stagger.item, delayChildren: reduced ? 0 : .04 } } }}>
          {items.map(item => {
            const menu = hasMenu(item);
            const expanded = section === item.value;
            return <motion.li key={item.value} className={styles.sheetItem}
              variants={{ hidden: reduced ? { opacity: 0 } : { opacity: 0, y: -6 }, shown: { opacity: 1, y: 0, transition: reduced ? { duration: .1 } : SLIDE } }}>
              {menu ? <>
                <button type="button" className={styles.sheetRow} aria-expanded={expanded} aria-controls={`${uid}-${item.value}`}
                  data-current={current === item.value || undefined} onClick={() => setSection(expanded ? null : item.value)}>
                  {item.label}<ChevronDown className={styles.chevron} aria-hidden="true" />
                </button>
                <AnimatePresence initial={false}>
                  {expanded ? <motion.div key="body" id={`${uid}-${item.value}`} role="region" aria-label={item.label} className={styles.sheetBody}
                    initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                    transition={reduced ? { duration: 0 } : { height: motionTokens.spring.smooth, opacity: { duration: .2, ease: standard } }}>
                    <div className={styles.sheetGroups}>
                      {item.groups?.map((group, index) => <div key={group.title ?? index} className={styles.sheetGroup}>
                        {group.title ? <p className={styles.groupTitle}>{group.title}</p> : null}
                        <ul className={styles.sheetLinks}>{group.links.map(link => <li key={link.label}>
                          <a className={styles.sheetLink} href={link.href ?? "#"} onClick={event => pick(event, { label: link.label, href: link.href, section: item.value })}>
                            {link.icon ? <span className={styles.linkIcon}>{link.icon}</span> : null}
                            <span className={styles.linkLabel}>{link.label}</span>
                            {link.badge ? <span className={styles.badge}>{link.badge}</span> : null}
                          </a>
                        </li>)}</ul>
                      </div>)}
                      {item.feature ? <a className={styles.sheetFeature} href={item.feature.href ?? "#"} onClick={event => pick(event, { label: item.feature!.title, href: item.feature!.href, section: item.value })}>
                        <span className={styles.featureTitle}>{item.feature.title}</span>
                        {item.feature.cta ? <span className={styles.featureCta}>{item.feature.cta}<ArrowRight aria-hidden="true" /></span> : null}
                      </a> : null}
                    </div>
                  </motion.div> : null}
                </AnimatePresence>
              </> : <a className={styles.sheetRow} href={item.href ?? "#"} data-current={current === item.value || undefined}
                aria-current={current === item.value ? "page" : undefined}
                onClick={event => pick(event, { label: item.label, href: item.href, section: item.value })}>{item.label}</a>}
            </motion.li>;
          })}
          {actions.some(action => action.variant !== "primary") ? <motion.li className={styles.sheetActions}
            variants={{ hidden: { opacity: 0 }, shown: { opacity: 1, transition: { duration: .2 } } }}>
            {actionNodes(false, actions.filter(action => action.variant !== "primary"))}
          </motion.li> : null}
        </motion.ul>
      </motion.div> : null}
    </AnimatePresence>
  </div>;
}

export default MegaMenuMorph;
