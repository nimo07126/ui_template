import type { ReactNode } from "react";
import { GeminiColorMark, OpenaiMark, XaiMark } from "./image-generation-marks";

/** A model the person can pick. `mark` is a 16px provider logo. */
export interface ImageGenerationModel {
  id: string;
  name: string;
  mark?: ReactNode;
}

/** An output shape. `width` and `height` are the pixels a generation returns at this ratio. */
export interface ImageGenerationAspect {
  id: string;
  label: string;
  width: number;
  height: number;
}

/** One generated image. */
export interface ImageGenerationImage {
  id: string;
  src: string;
  alt: string;
  width?: number;
  height?: number;
  seed?: number;
}

/** What one variation asks for. Generate and Vary call `onGenerate` once per tile, in parallel. */
export interface ImageGenerationRequest {
  prompt: string;
  model: ImageGenerationModel;
  aspect: ImageGenerationAspect;
  /** Which variation this is, 0 to 3. */
  index: number;
  count: number;
  /** Set when the person pressed Vary on an image. */
  variationOf?: ImageGenerationImage;
}

export interface ImageGenerationContext {
  /** Aborts when the person presses Stop, starts over, or the component unmounts. */
  signal: AbortSignal;
  /** Report progress from 0 to 1, with an optional low resolution preview URL. Without reports the ring estimates. */
  onProgress: (progress: number, preview?: string) => void;
}

const markProps = { width: 16, height: 16, "aria-hidden": true } as const;

/** Generic product names with real provider marks. Swap in the models your backend serves. */
export const imageGenerationModels: ImageGenerationModel[] = [
  { id: "gpt-image", name: "GPT Image", mark: <OpenaiMark {...markProps} /> },
  { id: "gemini-image", name: "Gemini Image", mark: <GeminiColorMark {...markProps} /> },
  { id: "grok-imagine", name: "Grok Imagine", mark: <XaiMark {...markProps} /> },
];

export const imageGenerationAspects: ImageGenerationAspect[] = [
  { id: "1:1", label: "1:1", width: 1024, height: 1024 },
  { id: "4:5", label: "4:5", width: 1024, height: 1280 },
  { id: "16:9", label: "16:9", width: 1536, height: 864 },
];

export const imageGenerationDefaultPrompt = "Cinematic landscapes at golden hour: an alpine lake under a glowing peak, hazy mountain ridges, a long coastline and a calm sea at dusk, shot on 35mm film";

export const imageGenerationSuggestions = [
  "Sculptural architecture, curved facades and terracotta waves against a clear blue sky",
  "Speckled stoneware cups and bowls on a pale table, soft window light",
  "Sunlit reading corner, woven oak lounge chair, linen throws, ceramic lamp",
];

type Photo = { src: string; alt: string };
const p = (id: string, alt: string): Photo => ({ src: `/media/photos/${id}.jpg`, alt });

/** Sample results, grouped so a prompt about a lake gets lakes. Real photos from the shared media set. */
const themes: { words: string[]; photos: Photo[] }[] = [
  // The default set: four golden hour landscapes in one warm palette, in the order the 2×2 grid reads best.
  { words: ["lake", "mountain", "coast", "sea", "alpine", "dusk", "beach", "ridge", "peak", "landscape", "ocean", "nature", "golden hour", "film"], photos: [
    p("alpine-lake", "A calm alpine lake reflecting a rocky peak glowing at golden hour"),
    p("mountain-ridges", "Hazy layered mountain ridges under a warm evening sky"),
    p("coastline", "A long coastline with waves rolling onto a beach below green cliffs"),
    p("sea-at-dusk", "A calm sea at dusk with a lighthouse on a low island"),
  ] },
  { words: ["room", "nook", "chair", "lamp", "interior", "living", "bed", "sofa", "linen", "reading", "corner", "cozy", "office"], photos: [
    p("lounge-chair", "A woven oak lounge chair with a sheepskin and linen cushion on a concrete floor"),
    p("ceramic-lamp", "A sculptural ceramic lamp with a linen shade on a walnut sideboard"),
    p("linen-throw", "Folded natural linen throws with fringed edges in soft window light"),
    p("reading-chair", "A grey armchair and ottoman with a knit throw in a dark green room"),
    p("living-room", "A bright living room with timber beams, arched windows, and cream sofas"),
    p("sunroom", "A sunroom with a round dining table, plants, and windows on three sides"),
    p("bedroom", "A made bed with striped linen pillows against an oak headboard"),
    p("home-office", "A home office with a wooden desk and deep green walls"),
  ] },
  { words: ["facade", "building", "architecture", "sculptural", "balcon", "concrete", "curved", "house", "pool", "terracotta", "wall", "tiled"], photos: [
    p("terracotta-waves", "Wavy terracotta walls rising toward a blue sky"),
    p("curved-facade", "A white tiled building facade with curved balconies"),
    p("concert-hall", "Curved stainless steel panels of a concert hall against a blue sky"),
    p("pool-house", "A modern glass house beside a long pool under a clear sky"),
  ] },
  { words: ["food", "dinner", "dish", "salmon", "restaurant", "wine", "chef", "plate", "meal", "kitchen"], photos: [
    p("salmon-dinner", "Seared salmon with a bright herb salsa and a glass of red wine"),
    p("chef-plating", "A chef spooning sauce onto a plated dish in a dark kitchen"),
    p("wine-bar", "A glass carafe of red wine on a bar table in low evening light"),
    p("restaurant", "A warm restaurant dining room with woven pendant lights and a tree"),
  ] },
  { words: ["cup", "bowl", "carafe", "stoneware", "ceramic", "product", "still life", "glass", "mug", "vase"], photos: [
    p("stoneware-cups", "Two speckled stoneware cups with a lid on a pale table"),
    p("stacked-bowls", "Two stacked speckled ceramic bowls against a dark wall"),
    p("glass-carafe", "A hand pouring water from a ribbed glass carafe into tumblers"),
    p("table-lamp", "A white mushroom table lamp glowing beside books and a small vase"),
  ] },
  { words: ["lisbon", "city", "street", "tram", "rooftop", "bridge", "town", "urban", "travel"], photos: [
    p("lisbon-rooftops", "Terracotta rooftops of Lisbon running down to the river"),
    p("lisbon-tram", "A yellow tram on a street lined with historic buildings in Lisbon"),
    p("lisbon-bridge", "The 25 de Abril Bridge crossing the Tagus in Lisbon"),
    p("curved-facade", "A white tiled building facade with curved balconies"),
  ] },
];

function themeFor(prompt: string) {
  const text = prompt.toLowerCase();
  let best = themes[0], score = 0;
  for (const theme of themes) {
    const hits = theme.words.filter(word => text.includes(word)).length;
    if (hits > score) { best = theme; score = hits; }
  }
  return best;
}

const wait = (ms: number, signal: AbortSignal) => new Promise<void>((resolve, reject) => {
  if (signal.aborted) { reject(new DOMException("Aborted", "AbortError")); return; }
  const timer = window.setTimeout(resolve, ms);
  signal.addEventListener("abort", () => { window.clearTimeout(timer); reject(new DOMException("Aborted", "AbortError")); }, { once: true });
});

/** Runs a progress curve frame by frame, so the ring and the preview move without steps. */
function runProgress(duration: number, signal: AbortSignal, onProgress: (value: number) => void, power = 1.6) {
  return new Promise<void>((resolve, reject) => {
    if (signal.aborted) { reject(new DOMException("Aborted", "AbortError")); return; }
    const start = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      // Quick to start, steady through the middle, easing into the last steps like a sampler.
      onProgress(1 - Math.pow(1 - t, power));
      if (t < 1) frame = requestAnimationFrame(tick); else resolve();
    };
    frame = requestAnimationFrame(tick);
    signal.addEventListener("abort", () => { cancelAnimationFrame(frame); reject(new DOMException("Aborted", "AbortError")); }, { once: true });
  });
}

let seedCounter = 418203;

/**
 * The built in generator: sample photos that match the prompt, revealed over about four and a half to six seconds. It
 * reports the photo as the preview from the start, so the loading state takes its colours and resolves into it.
 * Nothing is sent anywhere. Pass your own `onGenerate` with the same signature to call a real model.
 */
export async function simulateImageGeneration(request: ImageGenerationRequest, { signal, onProgress }: ImageGenerationContext): Promise<ImageGenerationImage> {
  const photos = themeFor(request.variationOf?.alt ?? request.prompt).photos;
  const base = request.variationOf ? Math.max(0, photos.findIndex(photo => photo.src === request.variationOf?.src)) + 1 : 0;
  const photo = photos[(base + request.index) % photos.length];
  await wait(80 + request.index * 90, signal);
  onProgress(0, photo.src);
  await runProgress(4400 + request.index * 320 + (request.prompt.length % 5) * 60, signal, value => onProgress(value, photo.src), 1.3);
  seedCounter += 7919;
  return { id: `${request.model.id}-${seedCounter}`, src: photo.src, alt: photo.alt, width: request.aspect.width, height: request.aspect.height, seed: seedCounter };
}

/** The built in upscaler: doubles the reported size after a short pass. Nothing is sent anywhere. */
export async function simulateImageUpscale(image: ImageGenerationImage, { signal, onProgress }: ImageGenerationContext): Promise<ImageGenerationImage> {
  // The sampler curve is front loaded; the upscale sweep reads better at an even, eased pace across the image.
  await runProgress(1400, signal, value => { const t = 1 - Math.pow(1 - value, 1 / 1.6); onProgress(t * t * (3 - 2 * t)); });
  return { ...image, id: `${image.id}-2x`, width: (image.width ?? 1024) * 2, height: (image.height ?? 1024) * 2 };
}
