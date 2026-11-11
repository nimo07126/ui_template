/**
 * Canvas 2D renderer for ImageReveal. No WebGL, no per-pixel work per frame, no per-frame allocation beyond gradients.
 *
 * It draws what a diffusion model actually shows while it samples. Built once per image and size: a cover-cropped sharp
 * copy at device resolution and a chain of predictions sampled from the image itself (6, 12, 24, 48 and 96 px wide,
 * smoothly upscaled). Per sampling step it builds one small frame of latent noise at roughly 1/8 resolution.
 *
 * Each frame composites, back to front:
 * 1. the surface tone, with a slow soft shimmer while queued,
 * 2. the model's current prediction, crossfaded along the blur chain by step: color blobs first, then composition,
 *    then shapes,
 * 3. the latent noise on top, blocky at latent resolution and crossfaded from the previous step, its strength following
 *    the noise schedule down to zero on the last step,
 * 4. the decode: the sharp image lands tile by tile in raster order, the way a tiled VAE decode returns it,
 * 5. a single light sheen once the image resolves, a crossfade snapshot when the photo is swapped, and the error veil.
 * At decode 1 the sharp copy covers everything, so the final frame is the untouched photo.
 */

export type Rgb = readonly [number, number, number];

export interface RevealPalette {
  /** Calm surface the queued state rests on. */
  base: Rgb;
  /** Slightly lifted tone for the queued shimmer. */
  highlight: Rgb;
  /** Wash used for the error state. */
  veil: Rgb;
}

export interface RevealFrame {
  /** Image presence, 0 (surface only) to 1 (the sampling preview fully shown). */
  bloom: number;
  /** Detail of the model's prediction, 0 (a few color blobs) to 1 (the near-sharp preview). */
  detail: number;
  /** Latent noise strength from the schedule, 0 to 1. */
  noise: number;
  /** Crossfade from the previous step's noise frame to the current one, 0 to 1. */
  noiseMix: number;
  /** Decode progress, 0 (latent preview) to 1 (every tile decoded to the sharp image). */
  decode: number;
  /** Hides the decoded image (used to clear out before a reset or a photo swap). */
  hide: number;
  /** Queued shimmer amount, 0 to 1. */
  shimmer: number;
  /** Seconds, integrated by the caller so speed changes never jump. */
  time: number;
  /** Sheen sweep, 0 to 1, or -1 when inactive. */
  sheen: number;
  /** Error veil amount, 0 to 1. */
  error: number;
  /** Reduced motion: the decode crossfades as one, no shimmer travel. */
  reduced: boolean;
}

const clamp01 = (value: number) => (value < 0 ? 0 : value > 1 ? 1 : value);
const smoothstep = (value: number) => {
  const t = clamp01(value);
  return t * t * (3 - 2 * t);
};
const rgba = (color: Rgb, alpha: number) => `rgba(${color[0] | 0}, ${color[1] | 0}, ${color[2] | 0}, ${alpha})`;

function mulberry32(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let r = Math.imul(state ^ (state >>> 15), 1 | state);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function makeCanvas(width: number, height: number) {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));
  return canvas;
}

function context(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  return ctx;
}

function resample(source: CanvasImageSource, width: number, height: number) {
  const canvas = makeCanvas(width, height);
  context(canvas).drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas;
}

/** Upscales by doubling, so bilinear steps compound into a smooth, gaussian-like blur with no creases. */
function softUpscale(source: HTMLCanvasElement, width: number, height: number) {
  let current = source;
  while (current.width * 2 < width) current = resample(current, current.width * 2, current.height * 2);
  return resample(current, width, height);
}

/** Widths of the prediction chain, softest first. The last one is the near-sharp preview the decode starts from. */
const CHAIN_WIDTHS = [6, 12, 24, 48, 96];
const SOFT_TARGET = 192;
/** Latent cell size in CSS pixels: image models work at 1/8 of the output resolution. */
const LATENT_CELL = 6;

export class RevealEngine {
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private seed: number;
  private cssWidth = 0;
  private cssHeight = 0;
  private dpr = 1;
  private image: HTMLImageElement | null = null;
  private pending: HTMLImageElement | null = null;
  private chain: HTMLCanvasElement[] = [];
  private sharp: HTMLCanvasElement | null = null;
  private snapshot: { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } | null = null;
  private palette: RevealPalette | null = null;
  private noiseStep = -1;
  private noiseFrames: { previous: HTMLCanvasElement | null; current: HTMLCanvasElement | null } = { previous: null, current: null };
  private noiseBlend: { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } | null = null;
  /** Snapshot crossfade after a photo swap, 1 to 0. */
  snapshotAlpha = 0;
  /** True when something changed that the next frame must show, even if no value moved. */
  dirty = true;

  constructor(canvas: HTMLCanvasElement, seed: number) {
    this.canvas = canvas;
    this.ctx = context(canvas);
    this.seed = seed;
  }

  get hasImage() {
    return this.sharp !== null;
  }

  get hasPending() {
    return this.pending !== null;
  }

  get ready() {
    return this.cssWidth > 0 && this.cssHeight > 0 && this.palette !== null;
  }

  setSeed(seed: number) {
    if (seed === this.seed) return;
    this.seed = seed;
    this.resetNoise();
    this.dirty = true;
  }

  resize(cssWidth: number, cssHeight: number, dpr: number) {
    if (cssWidth === this.cssWidth && cssHeight === this.cssHeight && dpr === this.dpr) return;
    this.cssWidth = cssWidth;
    this.cssHeight = cssHeight;
    this.dpr = dpr;
    if (!cssWidth || !cssHeight) return;
    this.canvas.width = Math.round(cssWidth * dpr);
    this.canvas.height = Math.round(cssHeight * dpr);
    this.ctx.imageSmoothingEnabled = true;
    this.ctx.imageSmoothingQuality = "high";
    this.snapshot = null;
    this.snapshotAlpha = 0;
    this.resetNoise();
    if (this.image) this.buildLevels();
    this.dirty = true;
  }

  setPalette(palette: RevealPalette) {
    this.palette = palette;
    this.dirty = true;
  }

  /** Queues a decoded image. The caller swaps it in with `swap()` once the decoded layer is hidden. */
  setImage(image: HTMLImageElement) {
    if (image === this.image) {
      this.pending = null;
      return;
    }
    this.pending = image;
  }

  /** Swaps in the pending image. With `crossfade`, the current frame is kept as a snapshot that fades out on top. */
  swap(crossfade: boolean) {
    if (!this.pending) return;
    if (crossfade && this.canvas.width && this.canvas.height) {
      if (!this.snapshot || this.snapshot.canvas.width !== this.canvas.width || this.snapshot.canvas.height !== this.canvas.height) {
        const canvas = makeCanvas(this.canvas.width, this.canvas.height);
        this.snapshot = { canvas, ctx: context(canvas) };
      }
      this.snapshot.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      this.snapshot.ctx.drawImage(this.canvas, 0, 0);
      this.snapshotAlpha = 1;
    }
    this.image = this.pending;
    this.pending = null;
    this.buildLevels();
    this.dirty = true;
  }

  /**
   * Moves the sampler to `step`: the current noise frame becomes the previous one and a new frame is drawn for this step.
   * Frames are seeded by seed and step, so a replay of the same seed shows the same noise.
   */
  setNoiseStep(step: number) {
    if (step === this.noiseStep || !this.cssWidth || !this.cssHeight) return;
    this.noiseStep = step;
    this.noiseFrames = { previous: this.noiseFrames.current, current: this.buildNoise(step) };
    this.dirty = true;
  }

  private resetNoise() {
    const step = this.noiseStep;
    this.noiseStep = -1;
    this.noiseFrames = { previous: null, current: null };
    this.noiseBlend = null;
    if (step >= 0) this.setNoiseStep(step);
  }

  /** One frame of latent noise: per-cell gaussian color, slightly correlated across channels like a decoded latent. */
  private buildNoise(step: number) {
    const width = Math.max(12, Math.round(this.cssWidth / LATENT_CELL));
    const height = Math.max(12, Math.round(this.cssHeight / LATENT_CELL));
    const canvas = makeCanvas(width, height);
    const ctx = canvas.getContext("2d")!;
    const data = ctx.createImageData(canvas.width, canvas.height);
    const random = mulberry32(this.seed * 104729 + step * 7919 + 3);
    const gauss = () => random() + random() + random() - 1.5;
    for (let i = 0; i < canvas.width * canvas.height; i += 1) {
      const shared = gauss() * 110;
      data.data[i * 4] = 128 + shared + gauss() * 80;
      data.data[i * 4 + 1] = 126 + shared + gauss() * 70;
      data.data[i * 4 + 2] = 130 + shared + gauss() * 86;
      data.data[i * 4 + 3] = 255;
    }
    ctx.putImageData(data, 0, 0);
    if (!this.noiseBlend || this.noiseBlend.canvas.width !== canvas.width || this.noiseBlend.canvas.height !== canvas.height) {
      const blend = makeCanvas(canvas.width, canvas.height);
      this.noiseBlend = { canvas: blend, ctx: blend.getContext("2d")! };
    }
    return canvas;
  }

  /** Cover-crops the photo once, then derives the prediction chain from it. */
  private buildLevels() {
    const image = this.image;
    const width = this.canvas.width;
    const height = this.canvas.height;
    if (!image || !width || !height) return;
    const aspect = width / height;
    const natural = image.naturalWidth / image.naturalHeight;
    let sw = image.naturalWidth;
    let sh = image.naturalHeight;
    if (natural > aspect) sw = sh * aspect;
    else sh = sw / aspect;
    const sx = (image.naturalWidth - sw) / 2;
    const sy = (image.naturalHeight - sh) / 2;

    const sharp = makeCanvas(width, height);
    context(sharp).drawImage(image, sx, sy, sw, sh, 0, 0, width, height);

    // Halve repeatedly from a 384 px copy: each step averages, so the tiny levels are true color samples of the image.
    const byWidth = new Map<number, HTMLCanvasElement>();
    let current = resample(sharp, Math.min(384, width), Math.min(384, width) / aspect);
    byWidth.set(current.width, current);
    while (current.width > CHAIN_WIDTHS[0]) {
      const next = Math.max(CHAIN_WIDTHS[0], Math.round(current.width / 2));
      current = resample(current, next, Math.max(2, Math.round(next / aspect)));
      byWidth.set(current.width, current);
    }
    const nearest = (target: number) => {
      let best = current;
      for (const [w, level] of byWidth) if (Math.abs(w - target) < Math.abs(best.width - target)) best = level;
      return best;
    };
    this.chain = CHAIN_WIDTHS.map((w, index) => {
      const target = Math.min(index === CHAIN_WIDTHS.length - 1 ? SOFT_TARGET * 2 : SOFT_TARGET, width);
      return softUpscale(nearest(w), target, Math.max(2, Math.round(target / aspect)));
    });
    this.sharp = sharp;
  }

  render(frame: RevealFrame) {
    const { ctx, palette } = this;
    const width = this.canvas.width;
    const height = this.canvas.height;
    if (!palette || !width || !height) return;
    this.dirty = false;
    const { time, reduced } = frame;
    const bloom = this.sharp ? clamp01(frame.bloom) : 0;

    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
    ctx.fillStyle = rgba(palette.base, 1);
    ctx.fillRect(0, 0, width, height);

    // Queued: one broad, soft diagonal sweep. The band starts and ends fully off canvas, so the loop has no seam.
    if (frame.shimmer > 0.002 && bloom < 0.999) {
      const period = 2.6;
      const phase = reduced ? 0.42 : (((time + this.seed * 0.14) % period) + period) % period / period;
      const travel = smoothstep(phase / 0.82);
      const span = width + height;
      const center = -0.45 * span + travel * 1.9 * span;
      const reach = span * 0.42;
      const gradient = ctx.createLinearGradient(center - reach, center * 0.35 - reach * 0.35, center + reach, center * 0.35 + reach * 0.35);
      const strength = frame.shimmer * (1 - bloom) * (reduced ? 0.5 : 1);
      gradient.addColorStop(0, rgba(palette.highlight, 0));
      gradient.addColorStop(0.5, rgba(palette.highlight, strength));
      gradient.addColorStop(1, rgba(palette.highlight, 0));
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);
    }

    if (bloom > 0.002 && this.sharp && this.chain.length) {
      const chain = this.chain;
      // The model's prediction: a crossfade along the chain, so detail arrives coarse to fine.
      const detail = clamp01(frame.detail) * (chain.length - 1);
      const low = Math.min(chain.length - 1, Math.floor(detail));
      const high = Math.min(chain.length - 1, low + 1);
      const mix = detail - low;
      ctx.globalAlpha = bloom;
      ctx.drawImage(chain[low], 0, 0, width, height);
      if (high !== low && mix > 0.002) {
        ctx.globalAlpha = bloom * mix;
        ctx.drawImage(chain[high], 0, 0, width, height);
      }

      // Latent noise at latent resolution, nearest-neighbour scaled so every cell stays a crisp block.
      const noise = clamp01(frame.noise) * bloom;
      const { previous, current } = this.noiseFrames;
      if (noise > 0.003 && current && this.noiseBlend) {
        const blend = this.noiseBlend;
        const noiseMix = previous ? clamp01(frame.noiseMix) : 1;
        blend.ctx.globalAlpha = 1;
        blend.ctx.drawImage(previous && noiseMix < 0.999 ? previous : current, 0, 0);
        if (previous && noiseMix < 0.999) {
          blend.ctx.globalAlpha = noiseMix;
          blend.ctx.drawImage(current, 0, 0);
        }
        ctx.imageSmoothingEnabled = false;
        ctx.globalAlpha = noise;
        ctx.drawImage(blend.canvas, 0, 0, width, height);
        ctx.imageSmoothingEnabled = true;
      }

      // Decode: tiles land in raster order, each with a short crossfade. Reduced motion decodes as one crossfade.
      const show = bloom * (1 - clamp01(frame.hide));
      const decode = clamp01(frame.decode);
      if (show > 0.002 && decode > 0.002) {
        if (reduced || decode >= 0.999) {
          ctx.globalAlpha = show * (reduced ? smoothstep(decode) : 1);
          ctx.drawImage(this.sharp, 0, 0);
        } else {
          const columns = this.cssWidth >= 320 ? 4 : 3;
          const rows = Math.max(2, Math.round((columns * this.cssHeight) / this.cssWidth));
          const count = columns * rows;
          const fade = 2.2;
          const reach = decode * (count + fade);
          for (let index = 0; index < count && index < reach; index += 1) {
            const alpha = smoothstep((reach - index) / fade);
            if (alpha <= 0.002) continue;
            const column = index % columns;
            const row = Math.floor(index / columns);
            const x = Math.round((column / columns) * width);
            const y = Math.round((row / rows) * height);
            const w = Math.round(((column + 1) / columns) * width) - x;
            const h = Math.round(((row + 1) / rows) * height) - y;
            ctx.globalAlpha = show * alpha;
            ctx.drawImage(this.sharp, x, y, w, h, x, y, w, h);
          }
        }
      }
      ctx.globalAlpha = 1;
    }

    // One light sheen at completion: a soft diagonal pass that brightens, never a glow.
    if (frame.sheen >= 0 && frame.sheen < 1 && !reduced && bloom > 0.5) {
      const pass = smoothstep(frame.sheen);
      const span = width + height;
      const center = -0.3 * span + pass * 1.6 * span;
      const reach = span * 0.2;
      const gradient = ctx.createLinearGradient(center - reach, (center - reach) * 0.5, center + reach, (center + reach) * 0.5);
      const strength = 0.42 * Math.sin(Math.PI * frame.sheen);
      gradient.addColorStop(0, "rgba(255, 255, 255, 0)");
      gradient.addColorStop(0.5, `rgba(255, 255, 255, ${strength})`);
      gradient.addColorStop(1, "rgba(255, 255, 255, 0)");
      ctx.globalCompositeOperation = "soft-light";
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);
      ctx.globalCompositeOperation = "source-over";
    }

    if (this.snapshot && this.snapshotAlpha > 0.002) {
      ctx.globalAlpha = this.snapshotAlpha;
      ctx.drawImage(this.snapshot.canvas, 0, 0);
      ctx.globalAlpha = 1;
    }

    if (frame.error > 0.002) {
      ctx.globalCompositeOperation = "saturation";
      ctx.globalAlpha = 0.9 * frame.error;
      ctx.fillStyle = "rgb(128, 128, 128)";
      ctx.fillRect(0, 0, width, height);
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = 0.72 * frame.error;
      ctx.fillStyle = rgba(palette.veil, 1);
      ctx.fillRect(0, 0, width, height);
    }
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
  }

  dispose() {
    this.chain = [];
    this.sharp = null;
    this.image = null;
    this.pending = null;
    this.snapshot = null;
    this.noiseFrames = { previous: null, current: null };
    this.noiseBlend = null;
  }
}

/* Palette: resolves semantic tokens through a probe element, so var() chains, color-mix and oklch all work. */

let parser: CanvasRenderingContext2D | null = null;

function parseColor(value: string): Rgb {
  parser ??= makeCanvas(1, 1).getContext("2d", { willReadFrequently: true });
  if (!parser) return [128, 128, 128];
  parser.clearRect(0, 0, 1, 1);
  parser.fillStyle = "#808080";
  parser.fillStyle = value;
  parser.fillRect(0, 0, 1, 1);
  const pixel = parser.getImageData(0, 0, 1, 1).data;
  return [pixel[0], pixel[1], pixel[2]];
}

function resolve(probe: HTMLElement, value: string): Rgb {
  probe.style.color = "";
  probe.style.color = value;
  return parseColor(getComputedStyle(probe).color);
}

const mixRgb = (from: Rgb, to: Rgb, amount: number): Rgb => [
  from[0] + (to[0] - from[0]) * amount,
  from[1] + (to[1] - from[1]) * amount,
  from[2] + (to[2] - from[2]) * amount,
];

export function readPalette(probe: HTMLElement): RevealPalette {
  const base = resolve(probe, "var(--arc-surface-muted, #eee)");
  const surface = resolve(probe, "var(--arc-surface, var(--arc-background, #fff))");
  const luminance = (0.2126 * base[0] + 0.7152 * base[1] + 0.0722 * base[2]) / 255;
  // Light surfaces lift toward white; dark surfaces lift only a touch, so the shimmer stays calm in both themes.
  const highlight = mixRgb(base, [255, 255, 255], luminance > 0.5 ? 0.6 : 0.06);
  return { base, highlight, veil: surface };
}
