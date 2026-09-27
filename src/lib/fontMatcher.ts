/**
 * Estimates the font of OCR'd words by rendering the recognized text in each
 * candidate font and comparing it against the word's pixels on the page.
 * Candidates are the three standard PDF families pdf-lib can draw with.
 */

export type MatchedFontFamily = 'Helvetica' | 'TimesRoman' | 'Courier';

export interface FontCandidate {
  family: MatchedFontFamily;
  isBold: boolean;
}

export interface FontCandidateScore extends FontCandidate {
  score: number; // lower is better
  fontSizePx: number; // canvas pixels
  descentPx: number; // ink below the baseline, canvas pixels
}

export interface WordPixelBox {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

const CSS_FAMILIES: Record<MatchedFontFamily, string> = {
  Helvetica: 'Helvetica, Arial, sans-serif',
  TimesRoman: '"Times New Roman", Times, serif',
  Courier: '"Courier New", Courier, monospace',
};

export const FONT_CANDIDATES: FontCandidate[] = [
  { family: 'Helvetica', isBold: false },
  { family: 'Helvetica', isBold: true },
  { family: 'TimesRoman', isBold: false },
  { family: 'TimesRoman', isBold: true },
  { family: 'Courier', isBold: false },
  { family: 'Courier', isBold: true },
];

const MEASURE_SIZE = 100;

let workCanvas: HTMLCanvasElement | null = null;
function getWorkContext(): CanvasRenderingContext2D {
  if (!workCanvas) workCanvas = document.createElement('canvas');
  return workCanvas.getContext('2d', { willReadFrequently: true })!;
}

function luminance(r: number, g: number, b: number) {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

function toHex(r: number, g: number, b: number) {
  return (
    '#' +
    [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')
  );
}

function parseHex(hex: string): [number, number, number] {
  const n = parseInt(hex.replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export interface WordInkAnalysis {
  textColor: string;
  scores: FontCandidateScore[];
}

/**
 * Scores every font candidate for one word. Returns null when the crop has
 * too little ink to say anything useful.
 */
export function analyzeWordInk(
  pageCtx: CanvasRenderingContext2D,
  text: string,
  box: WordPixelBox,
  backgroundHex: string
): WordInkAnalysis | null {
  const x0 = Math.max(0, Math.floor(box.x0));
  const y0 = Math.max(0, Math.floor(box.y0));
  const w = Math.min(pageCtx.canvas.width, Math.ceil(box.x1)) - x0;
  const h = Math.min(pageCtx.canvas.height, Math.ceil(box.y1)) - y0;
  if (w < 3 || h < 3 || !text) return null;

  const crop = pageCtx.getImageData(x0, y0, w, h).data;
  const [bgR, bgG, bgB] = parseHex(backgroundHex);
  const bgLum = luminance(bgR, bgG, bgB);

  // Ink = pixels that differ clearly from the paper (works for light-on-dark too).
  const cropMask = new Uint8Array(w * h);
  const contrasts = new Float32Array(w * h);
  let inkCount = 0;
  let maxContrast = 0;
  for (let i = 0, p = 0; i < crop.length; i += 4, p++) {
    const contrast = Math.abs(luminance(crop[i], crop[i + 1], crop[i + 2]) - bgLum);
    contrasts[p] = contrast;
    if (contrast > 60) {
      cropMask[p] = 1;
      inkCount++;
    }
    if (contrast > maxContrast) maxContrast = contrast;
  }
  if (inkCount < 4) return null;

  // Anti-aliased edges are a blend with the paper; only the core of a stroke has the real ink color.
  let coreR = 0, coreG = 0, coreB = 0, coreCount = 0;
  const coreThreshold = maxContrast * 0.85;
  for (let i = 0, p = 0; i < crop.length; i += 4, p++) {
    if (contrasts[p] >= coreThreshold) {
      coreR += crop[i];
      coreG += crop[i + 1];
      coreB += crop[i + 2];
      coreCount++;
    }
  }
  const textColor = toHex(coreR / coreCount, coreG / coreCount, coreB / coreCount);

  const ctx = getWorkContext();
  const canvas = ctx.canvas;
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }

  const cropAspect = w / h;
  const scores: FontCandidateScore[] = [];

  for (const cand of FONT_CANDIDATES) {
    const font = `${cand.isBold ? 'bold ' : ''}${MEASURE_SIZE}px ${CSS_FAMILIES[cand.family]}`;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.font = font;
    const m = ctx.measureText(text);
    const inkW = m.actualBoundingBoxLeft + m.actualBoundingBoxRight;
    const inkH = m.actualBoundingBoxAscent + m.actualBoundingBoxDescent;
    if (inkW <= 0 || inkH <= 0) continue;

    // Stretch the candidate's ink box onto the crop so we compare glyph shapes.
    ctx.clearRect(0, 0, w, h);
    ctx.setTransform(w / inkW, 0, 0, h / inkH, 0, 0);
    ctx.fillStyle = '#000';
    ctx.fillText(text, m.actualBoundingBoxLeft, m.actualBoundingBoxAscent);
    const rendered = ctx.getImageData(0, 0, w, h).data;

    let inter = 0, union = 0;
    for (let p = 0, i = 3; p < cropMask.length; p++, i += 4) {
      const a = rendered[i] > 110 ? 1 : 0;
      const b = cropMask[p];
      inter += a & b;
      union += a | b;
    }
    const iou = union > 0 ? inter / union : 0;

    // Stretching hides width differences (e.g. monospace vs proportional), so penalize them separately.
    const aspectPenalty = Math.abs(Math.log(inkW / inkH / cropAspect));

    // Width is the more reliable size cue for longer words, height for short ones.
    const sizeFromW = (MEASURE_SIZE * w) / inkW;
    const sizeFromH = (MEASURE_SIZE * h) / inkH;
    const wWeight = Math.min(text.length, 6) / 6;
    const fontSizePx = sizeFromW * wWeight + sizeFromH * (1 - wWeight);

    scores.push({
      ...cand,
      score: 1 - iou + aspectPenalty,
      fontSizePx,
      descentPx: (m.actualBoundingBoxDescent * fontSizePx) / MEASURE_SIZE,
    });
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0);

  return scores.length > 0 ? { textColor, scores } : null;
}

/**
 * Picks the font that best fits a whole line. Fonts rarely change mid-line, and
 * pooling words avoids short words ("a", "of") flipping the result.
 */
export function pickLineFont(
  words: { text: string; analysis: WordInkAnalysis | null }[]
): FontCandidate | null {
  const totals = new Map<string, { cand: FontCandidate; total: number }>();
  for (const { text, analysis } of words) {
    if (!analysis) continue;
    const weight = Math.min(text.length, 8);
    for (const s of analysis.scores) {
      const key = `${s.family}|${s.isBold}`;
      const entry = totals.get(key) || { cand: { family: s.family, isBold: s.isBold }, total: 0 };
      entry.total += s.score * weight;
      totals.set(key, entry);
    }
  }
  let best: { cand: FontCandidate; total: number } | null = null;
  for (const entry of totals.values()) {
    if (!best || entry.total < best.total) best = entry;
  }
  return best ? best.cand : null;
}
