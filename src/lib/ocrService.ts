import { createWorker } from 'tesseract.js';
import { analyzeWordInk, pickLineFont, MatchedFontFamily, WordInkAnalysis } from './fontMatcher';

export interface OcrWord {
  text: string;
  pdfX: number;
  pdfY: number; // bottom of bounding box in PDF points
  pdfBaseline: number;
  pdfWidth: number;
  pdfHeight: number;
  pageIndex: number;
  sampledColor: string;
  // Estimated appearance of the original word, used to draw a matching replacement
  sampledTextColor: string;
  fontFamily: MatchedFontFamily;
  isBold: boolean;
  fontSize: number; // PDF points
}

let workerPromise: Promise<any> | null = null;

async function getWorker() {
  if (!workerPromise) {
    workerPromise = (async () => {
      const worker = await createWorker('eng');
      return worker;
    })();
  }
  return workerPromise;
}

/**
 * Samples the average background color around a bounding box from the canvas.
 */
function sampleBackgroundColor(
  ctx: CanvasRenderingContext2D,
  x0: number,
  y0: number,
  x1: number,
  y1: number
): string {
  try {
    // Sample 5 points around the box (above, left, right)
    const points = [
      { x: Math.max(0, x0 - 4), y: Math.max(0, y0 + 2) },
      { x: Math.max(0, x0 - 4), y: Math.max(0, y1 - 2) },
      { x: Math.max(0, x0 + 4), y: Math.max(0, y0 - 4) },
      { x: Math.min(ctx.canvas.width - 1, x1 + 4), y: Math.max(0, y0 + 2) },
    ];

    let rTotal = 0, gTotal = 0, bTotal = 0, count = 0;
    for (const pt of points) {
      const pixel = ctx.getImageData(Math.floor(pt.x), Math.floor(pt.y), 1, 1).data;
      // Skip pure transparent or extremely dark ink pixels
      if (pixel[3] > 0 && (pixel[0] + pixel[1] + pixel[2]) / 3 > 90) {
        rTotal += pixel[0];
        gTotal += pixel[1];
        bTotal += pixel[2];
        count++;
      }
    }

    if (count === 0) return '#ffffff';

    const r = Math.round(rTotal / count).toString(16).padStart(2, '0');
    const g = Math.round(gTotal / count).toString(16).padStart(2, '0');
    const b = Math.round(bTotal / count).toString(16).padStart(2, '0');
    return `#${r}${g}${b}`;
  } catch {
    return '#ffffff';
  }
}

/**
 * Runs OCR on a rendered canvas representing a PDF page.
 */
export async function runOcrOnPage(
  canvas: HTMLCanvasElement,
  pageWidth: number, // in PDF points
  pageHeight: number, // in PDF points
  pageIndex: number,
  onProgress?: (percent: number) => void
): Promise<OcrWord[]> {
  const worker = await getWorker();

  const ret = await worker.recognize(canvas, {}, { blocks: true });
  const words: OcrWord[] = [];

  const canvasWidth = canvas.width;
  const canvasHeight = canvas.height;
  const scaleX = pageWidth / canvasWidth;
  const scaleY = pageHeight / canvasHeight;

  const ctx = canvas.getContext('2d');

  for (const block of ret.data.blocks || []) {
    for (const paragraph of block.paragraphs || []) {
      for (const line of paragraph.lines || []) {
        const lineWords: { w: any; text: string; sampledColor: string; analysis: WordInkAnalysis | null }[] = (line.words || [])
          .map((w: any) => ({ w, text: w.text.trim() as string }))
          .filter((lw: { text: string }) => lw.text.length > 0)
          .map((lw: { w: any; text: string }) => {
            const { x0, y0, x1, y1 } = lw.w.bbox;
            const sampledColor = ctx ? sampleBackgroundColor(ctx, x0, y0, x1, y1) : '#ffffff';
            let analysis: WordInkAnalysis | null = null;
            try {
              analysis = ctx ? analyzeWordInk(ctx, lw.text, lw.w.bbox, sampledColor) : null;
            } catch {
              analysis = null;
            }
            return { ...lw, sampledColor, analysis };
          });

        const lineFont = pickLineFont(lineWords);
        const family: MatchedFontFamily = lineFont?.family ?? 'Helvetica';

        // Line-wide size, so replacements on the same line stay consistent.
        const lineSizes = lineWords
          .map((lw) => lw.analysis?.scores.find((s) => s.family === family && s.isBold === lineFont?.isBold)?.fontSizePx)
          .filter((v): v is number => v !== undefined)
          .sort((a, b) => a - b);
        const lineSizePx = lineSizes.length > 0 ? lineSizes[Math.floor(lineSizes.length / 2)] : null;

        for (const { w, text, sampledColor, analysis } of lineWords) {
          const { x0, y0, x1, y1 } = w.bbox;
          const pdfX = x0 * scaleX;
          const pdfWidth = (x1 - x0) * scaleX;
          const pdfHeight = (y1 - y0) * scaleY;
          // In PDF coordinates, origin is bottom-left
          const pdfY = pageHeight - (y1 * scaleY);

          // Bold can change word-to-word (e.g. "Total:" in bold, value in regular),
          // but very short words don't carry enough pixels to decide on their own.
          const regular = analysis?.scores.find((s) => s.family === family && !s.isBold);
          const bold = analysis?.scores.find((s) => s.family === family && s.isBold);
          const isBold =
            text.length >= 3 && regular && bold ? bold.score < regular.score : Boolean(lineFont?.isBold);
          const chosen = isBold ? bold : regular;

          const fontSizePx = lineSizePx ?? chosen?.fontSizePx ?? (y1 - y0) / 0.75;
          const descentPx = chosen ? (chosen.descentPx * fontSizePx) / chosen.fontSizePx : (y1 - y0) * 0.15;
          const pdfBaseline = pageHeight - (y1 - descentPx) * scaleY;

          words.push({
            text,
            pdfX,
            pdfY,
            pdfBaseline,
            pdfWidth,
            pdfHeight,
            pageIndex,
            sampledColor,
            sampledTextColor: analysis?.textColor ?? '#000000',
            fontFamily: family,
            isBold,
            fontSize: fontSizePx * scaleY,
          });
        }
      }
    }
  }

  return words;
}
