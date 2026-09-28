import { pdfjsLib } from './pdfWorker';

const clean = (w: string) => w.replace(/^[^\w₹$€£]+|[^\w%]+$/g, '');

/** Collects the unique words in a PDF's text layer (empty for images and scans). */
export async function extractPdfWords(pdfBytes: Uint8Array): Promise<string[]> {
  const doc = await pdfjsLib.getDocument({ data: pdfBytes.slice(0) }).promise;
  const words = new Set<string>();
  try {
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      for (const item of content.items as any[]) {
        for (const raw of (item.str || '').split(/\s+/)) {
          const w = clean(raw);
          if (w) words.add(w);
        }
      }
    }
  } finally {
    await doc.destroy();
  }
  return [...words];
}

function editDistance(a: string, b: string): number {
  const prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0];
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j];
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1));
      diag = tmp;
    }
  }
  return prev[b.length];
}

/**
 * Words from the document that the user probably meant when their find text
 * matched nothing: near-misses by spelling, or words that start with what they typed.
 */
export function suggestWords(target: string, vocabulary: string[], limit = 3): string[] {
  const t = target.trim().toLowerCase();
  if (t.length < 2 || /\s/.test(t)) return [];
  const maxDist = Math.max(1, Math.floor(t.length / 3));

  const scored: { word: string; score: number }[] = [];
  for (const word of vocabulary) {
    const w = word.toLowerCase();
    if (w === t) continue;
    if (w.startsWith(t)) {
      scored.push({ word, score: 0.5 });
      continue;
    }
    if (Math.abs(w.length - t.length) > maxDist) continue;
    const d = editDistance(t, w);
    if (d <= maxDist) scored.push({ word, score: d });
  }
  scored.sort((a, b) => a.score - b.score || a.word.length - b.word.length);
  return scored.slice(0, limit).map((s) => s.word);
}
