import { createWorker } from 'tesseract.js';

export interface OcrWord {
  text: string;
  pdfX: number;
  pdfY: number; // bottom of bounding box in PDF points
  pdfBaseline: number;
  pdfWidth: number;
  pdfHeight: number;
  pageIndex: number;
  sampledColor: string;
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
        for (const w of line.words || []) {
          const cleanText = w.text.trim();
          if (!cleanText) continue;

          const { x0, y0, x1, y1 } = w.bbox;
          const pdfX = x0 * scaleX;
          const pdfWidth = (x1 - x0) * scaleX;
          const pdfHeight = (y1 - y0) * scaleY;
          // In PDF coordinates, origin is bottom-left
          const pdfY = pageHeight - (y1 * scaleY);
          const pdfBaseline = pdfY + pdfHeight * 0.15;

          const sampledColor = ctx ? sampleBackgroundColor(ctx, x0, y0, x1, y1) : '#ffffff';

          words.push({
            text: cleanText,
            pdfX,
            pdfY,
            pdfBaseline,
            pdfWidth,
            pdfHeight,
            pageIndex,
            sampledColor,
          });
        }
      }
    }
  }

  return words;
}
