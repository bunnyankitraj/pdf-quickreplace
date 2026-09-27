import { PDFDocument } from 'pdf-lib';
import { pdfjsLib } from './pdfWorker';

export const SUPPORTED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/bmp'];
const IMAGE_EXT_RE = /\.(png|jpe?g|webp|gif|bmp)$/i;

// Longest page side in PDF points. Keeps huge photos at a sane page size;
// the embedded image itself keeps full resolution.
const MAX_PAGE_SIDE_PT = 1400;

export interface SourceImageInfo {
  mimeType: string;
  pixelWidth: number;
  pixelHeight: number;
}

export function isImageFile(file: File): boolean {
  return SUPPORTED_IMAGE_TYPES.includes(file.type) || IMAGE_EXT_RE.test(file.name);
}

async function decodeImage(file: File): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Wraps an image file in a single-page PDF so the existing
 * scanned-PDF (OCR) pipeline can edit it.
 */
export async function imageFileToPdf(
  file: File
): Promise<{ pdfBytes: Uint8Array; info: SourceImageInfo }> {
  const img = await decodeImage(file);
  const pixelWidth = img.naturalWidth;
  const pixelHeight = img.naturalHeight;

  const pdfDoc = await PDFDocument.create();
  const isJpeg = file.type === 'image/jpeg' || /\.jpe?g$/i.test(file.name);
  const isPng = file.type === 'image/png' || /\.png$/i.test(file.name);

  let embedded;
  if (isJpeg) {
    embedded = await pdfDoc.embedJpg(await file.arrayBuffer());
  } else if (isPng) {
    embedded = await pdfDoc.embedPng(await file.arrayBuffer());
  } else {
    // pdf-lib only understands PNG/JPEG — re-encode anything else via canvas.
    const canvas = document.createElement('canvas');
    canvas.width = pixelWidth;
    canvas.height = pixelHeight;
    canvas.getContext('2d')!.drawImage(img, 0, 0);
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Image encode failed'))), 'image/png')
    );
    embedded = await pdfDoc.embedPng(await blob.arrayBuffer());
  }

  // 96 DPI → 72 pt, clamped so very large photos don't produce giant pages.
  let pageW = pixelWidth * 0.75;
  let pageH = pixelHeight * 0.75;
  const shrink = Math.min(1, MAX_PAGE_SIDE_PT / Math.max(pageW, pageH));
  pageW *= shrink;
  pageH *= shrink;

  const page = pdfDoc.addPage([pageW, pageH]);
  page.drawImage(embedded, { x: 0, y: 0, width: pageW, height: pageH });

  return {
    pdfBytes: await pdfDoc.save(),
    info: { mimeType: isJpeg ? 'image/jpeg' : file.type || 'image/png', pixelWidth, pixelHeight },
  };
}

/**
 * Renders the first page of an (edited) PDF back into an image at the
 * original image's pixel dimensions.
 */
export async function pdfToImage(
  pdfBytes: Uint8Array,
  info: SourceImageInfo
): Promise<{ blob: Blob; extension: string }> {
  const doc = await pdfjsLib.getDocument({ data: pdfBytes.slice(0) }).promise;
  const page = await doc.getPage(1);
  const base = page.getViewport({ scale: 1 });
  const viewport = page.getViewport({ scale: info.pixelWidth / base.width });

  const canvas = document.createElement('canvas');
  canvas.width = info.pixelWidth;
  canvas.height = info.pixelHeight;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvasContext: ctx, viewport }).promise;
  await doc.destroy();

  const outType =
    info.mimeType === 'image/jpeg' || info.mimeType === 'image/webp' ? info.mimeType : 'image/png';
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('Image export failed'))),
      outType,
      0.95
    )
  );
  // Browsers without WebP encoding silently fall back to PNG, so trust blob.type.
  const extension = blob.type === 'image/jpeg' ? 'jpg' : blob.type === 'image/webp' ? 'webp' : 'png';
  return { blob, extension };
}
