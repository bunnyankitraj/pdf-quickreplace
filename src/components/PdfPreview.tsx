import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Eye,
  EyeOff,
  Loader2,
  ScanText,
  Crop,
  Check,
  AlertCircle,
  Maximize2,
  ArrowLeftRight,
} from 'lucide-react';
import { pdfjsLib } from '../lib/pdfWorker';
import { MatchOccurrence, ManualBox } from '../lib/pdfReplacer';
import { runOcrOnPage, OcrWord } from '../lib/ocrService';

interface PdfPreviewProps {
  pdfBytes: Uint8Array;
  pageCount: number;
  occurrences: MatchOccurrence[];
  isScannedPdf: boolean;
  onOcrCompleted: (pageIndex: number, words: OcrWord[]) => void;
  onManualBoxCreated: (box: ManualBox) => void;
}

export const PdfPreview: React.FC<PdfPreviewProps> = ({
  pdfBytes,
  pageCount,
  occurrences,
  isScannedPdf,
  onOcrCompleted,
  onManualBoxCreated,
}) => {
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [scale, setScale] = useState<number>(1.0);
  const [showHighlights, setShowHighlights] = useState<boolean>(true);
  const [isRendering, setIsRendering] = useState<boolean>(false);
  const [isOcrRunning, setIsOcrRunning] = useState<boolean>(false);
  const [ocrSuccessMsg, setOcrSuccessMsg] = useState<string | null>(null);

  // Manual Box selection state
  const [isDrawMode, setIsDrawMode] = useState<boolean>(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const [currentDrag, setCurrentDrag] = useState<{ x: number; y: number } | null>(null);

  const [pageViewport, setPageViewport] = useState<{
    width: number;
    height: number;
    scale: number;
    pdfWidth: number;
    pdfHeight: number;
  } | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const renderTaskRef = useRef<any>(null);

  const pageIndex = currentPage - 1;
  const currentPageMatches = occurrences.filter((o) => o.pageIndex === pageIndex);

  // Fit to Page handler
  const handleFitPage = useCallback(() => {
    if (!containerRef.current || !pageViewport) return;
    const containerWidth = containerRef.current.clientWidth - 48;
    const containerHeight = containerRef.current.clientHeight - 48;
    if (containerWidth <= 0 || containerHeight <= 0) return;

    const scaleX = containerWidth / pageViewport.pdfWidth;
    const scaleY = containerHeight / pageViewport.pdfHeight;
    const newScale = Math.min(scaleX, scaleY, 2.5);
    setScale(Math.max(0.4, parseFloat(newScale.toFixed(2))));
  }, [pageViewport]);

  // Fit to Width handler
  const handleFitWidth = useCallback(() => {
    if (!containerRef.current || !pageViewport) return;
    const containerWidth = containerRef.current.clientWidth - 48;
    if (containerWidth <= 0) return;

    const newScale = containerWidth / pageViewport.pdfWidth;
    setScale(Math.max(0.4, Math.min(2.5, parseFloat(newScale.toFixed(2)))));
  }, [pageViewport]);

  useEffect(() => {
    let isCancelled = false;

    const renderPage = async () => {
      if (!canvasRef.current || !pdfBytes) return;

      setIsRendering(true);

      try {
        if (renderTaskRef.current) {
          renderTaskRef.current.cancel();
        }

        const doc = await pdfjsLib.getDocument({ data: pdfBytes.slice(0) }).promise;
        if (isCancelled) return;

        const page = await doc.getPage(currentPage);
        if (isCancelled) return;

        const unscaledViewport = page.getViewport({ scale: 1.0 });
        const viewport = page.getViewport({ scale });

        setPageViewport({
          width: viewport.width,
          height: viewport.height,
          scale,
          pdfWidth: unscaledViewport.width,
          pdfHeight: unscaledViewport.height,
        });

        const canvas = canvasRef.current;
        const context = canvas.getContext('2d');
        if (!context) return;

        const pixelRatio = window.devicePixelRatio || 1;
        canvas.width = Math.floor(viewport.width * pixelRatio);
        canvas.height = Math.floor(viewport.height * pixelRatio);
        canvas.style.width = `${viewport.width}px`;
        canvas.style.height = `${viewport.height}px`;

        context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);

        const renderContext = {
          canvasContext: context,
          viewport: viewport,
        };

        const renderTask = page.render(renderContext);
        renderTaskRef.current = renderTask;

        await renderTask.promise;
      } catch (err: any) {
        if (err?.name !== 'RenderingCancelledException') {
          console.error('Error rendering page preview:', err);
        }
      } finally {
        if (!isCancelled) {
          setIsRendering(false);
        }
      }
    };

    renderPage();

    return () => {
      isCancelled = true;
      if (renderTaskRef.current) {
        renderTaskRef.current.cancel();
      }
    };
  }, [pdfBytes, currentPage, scale]);

  const handleRunOcr = async () => {
    if (!canvasRef.current || !pageViewport) return;

    setIsOcrRunning(true);
    setOcrSuccessMsg(null);
    try {
      const words = await runOcrOnPage(
        canvasRef.current,
        pageViewport.pdfWidth,
        pageViewport.pdfHeight,
        pageIndex
      );

      onOcrCompleted(pageIndex, words);
      setOcrSuccessMsg(`Found ${words.length} words via OCR!`);
      setTimeout(() => setOcrSuccessMsg(null), 5000);
    } catch (err) {
      console.error('OCR failed:', err);
      alert('OCR failed to recognize words on this image.');
    } finally {
      setIsOcrRunning(false);
    }
  };

  // Mouse events for drawing manual replacement box
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDrawMode || !pageViewport) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setDragStart({ x, y });
    setCurrentDrag({ x, y });
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDrawMode || !dragStart || !pageViewport) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
    const y = Math.max(0, Math.min(rect.height, e.clientY - rect.top));
    setCurrentDrag({ x, y });
  };

  const handleMouseUp = () => {
    if (!isDrawMode || !dragStart || !currentDrag || !pageViewport) {
      setDragStart(null);
      setCurrentDrag(null);
      return;
    }

    const minX = Math.min(dragStart.x, currentDrag.x);
    const maxX = Math.max(dragStart.x, currentDrag.x);
    const minY = Math.min(dragStart.y, currentDrag.y);
    const maxY = Math.max(dragStart.y, currentDrag.y);

    const width = maxX - minX;
    const height = maxY - minY;

    if (width > 8 && height > 6) {
      const pdfX = minX / scale;
      const pdfWidth = width / scale;
      const pdfHeight = height / scale;
      const pdfY = pageViewport.pdfHeight - maxY / scale;

      // Sample paper color & ink color from pixels
      let sampledColor = '#ffffff';
      let sampledTextColor = '#000000';

      if (canvasRef.current) {
        try {
          const ctx = canvasRef.current.getContext('2d');
          if (ctx) {
            const pixelRatio = window.devicePixelRatio || 1;
            const sx = Math.max(0, Math.floor(minX * pixelRatio));
            const sy = Math.max(0, Math.floor(minY * pixelRatio));
            const sw = Math.min(canvasRef.current.width - sx, Math.floor(width * pixelRatio));
            const sh = Math.min(canvasRef.current.height - sy, Math.floor(height * pixelRatio));

            if (sw > 0 && sh > 0) {
              const imgData = ctx.getImageData(sx, sy, sw, sh).data;
              let darkR = 0, darkG = 0, darkB = 0, darkCount = 0;
              let lightR = 0, lightG = 0, lightB = 0, lightCount = 0;

              for (let i = 0; i < imgData.length; i += 4) {
                const r = imgData[i];
                const g = imgData[i + 1];
                const b = imgData[i + 2];
                const a = imgData[i + 3];
                if (a === 0) continue;

                const lum = (r + g + b) / 3;
                if (lum > 180) {
                  lightR += r;
                  lightG += g;
                  lightB += b;
                  lightCount++;
                } else if (lum < 140) {
                  darkR += r;
                  darkG += g;
                  darkB += b;
                  darkCount++;
                }
              }

              if (lightCount > 0) {
                const lr = Math.round(lightR / lightCount).toString(16).padStart(2, '0');
                const lg = Math.round(lightG / lightCount).toString(16).padStart(2, '0');
                const lb = Math.round(lightB / lightCount).toString(16).padStart(2, '0');
                sampledColor = `#${lr}${lg}${lb}`;
              }

              if (darkCount > 0) {
                const dr = Math.round(darkR / darkCount).toString(16).padStart(2, '0');
                const dg = Math.round(darkG / darkCount).toString(16).padStart(2, '0');
                const db = Math.round(darkB / darkCount).toString(16).padStart(2, '0');
                sampledTextColor = `#${dr}${dg}${db}`;
              }
            }
          }
        } catch {
          // fallback
        }
      }

      onManualBoxCreated({
        pageIndex,
        pdfX,
        pdfY,
        pdfWidth,
        pdfHeight,
        sampledColor,
        sampledTextColor,
        fontFamily: isScannedPdf ? 'Courier' : 'auto',
      });

      setIsDrawMode(false);
    }

    setDragStart(null);
    setCurrentDrag(null);
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
      {/* Notice Banner for Scanned / Image-only PDFs */}
      {isScannedPdf && (
        <div className="p-3 bg-amber-50 border-b border-amber-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs text-amber-900">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              <strong>Scanned / Image PDF Detected:</strong> Document has no selectable text layer.
            </span>
          </div>
          <button
            disabled={isOcrRunning}
            onClick={handleRunOcr}
            className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-semibold shadow-xs disabled:opacity-50 transition-colors"
          >
            {isOcrRunning ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Reading Image Words...</span>
              </>
            ) : (
              <>
                <ScanText className="w-3.5 h-3.5" />
                <span>Run OCR (Detect Words)</span>
              </>
            )}
          </button>
        </div>
      )}

      {ocrSuccessMsg && (
        <div className="p-2.5 bg-emerald-50 border-b border-emerald-200 flex items-center space-x-2 text-xs text-emerald-800 animate-in fade-in">
          <Check className="w-4 h-4 text-emerald-600" />
          <span>{ocrSuccessMsg}</span>
        </div>
      )}

      {/* Controls toolbar */}
      <div className="p-3 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs">
        {/* Page Nav */}
        <div className="flex items-center space-x-1.5">
          <button
            disabled={currentPage <= 1}
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            className="p-1.5 rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            title="Previous page"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="font-medium text-slate-700 px-1">
            Page {currentPage} of {pageCount}
          </span>
          <button
            disabled={currentPage >= pageCount}
            onClick={() => setCurrentPage((p) => Math.min(pageCount, p + 1))}
            className="p-1.5 rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            title="Next page"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Zoom Controls & Fit Options */}
        <div className="flex items-center space-x-1.5">
          <button
            onClick={() => setScale((s) => Math.max(0.4, parseFloat((s - 0.15).toFixed(2))))}
            className="p-1.5 rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 transition-colors"
            title="Zoom out"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <span className="w-12 text-center font-medium text-slate-600">
            {Math.round(scale * 100)}%
          </span>
          <button
            onClick={() => setScale((s) => Math.min(2.5, parseFloat((s + 0.15).toFixed(2))))}
            className="p-1.5 rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 transition-colors"
            title="Zoom in"
          >
            <ZoomIn className="w-4 h-4" />
          </button>

          <div className="h-4 w-[1px] bg-slate-200 mx-1" />

          {/* Fit Page Button */}
          <button
            onClick={handleFitPage}
            className="inline-flex items-center space-x-1 px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 transition-colors font-medium"
            title="Fit whole page in viewer"
          >
            <Maximize2 className="w-3.5 h-3.5 text-blue-600" />
            <span className="hidden sm:inline">Fit Page</span>
          </button>

          {/* Fit Width Button */}
          <button
            onClick={handleFitWidth}
            className="inline-flex items-center space-x-1 px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 transition-colors font-medium"
            title="Fit page width to container"
          >
            <ArrowLeftRight className="w-3.5 h-3.5 text-slate-500" />
            <span className="hidden sm:inline">Fit Width</span>
          </button>
        </div>

        {/* Action Tools: Highlights, OCR, Draw Box */}
        <div className="flex items-center space-x-1.5">
          <button
            onClick={() => setIsDrawMode(!isDrawMode)}
            className={`inline-flex items-center space-x-1 px-2.5 py-1.5 rounded-lg border transition-colors ${
              isDrawMode
                ? 'bg-blue-600 border-blue-600 text-white shadow-xs'
                : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
            }`}
            title="Click and drag on the PDF to select any text area to replace"
          >
            <Crop className="w-3.5 h-3.5" />
            <span>{isDrawMode ? 'Cancel' : 'Select on PDF'}</span>
          </button>

          <button
            disabled={isOcrRunning}
            onClick={handleRunOcr}
            className="inline-flex items-center space-x-1 px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 transition-colors"
            title="Run OCR to recognize words on this page"
          >
            {isOcrRunning ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <ScanText className="w-3.5 h-3.5 text-blue-600" />
            )}
            <span>OCR</span>
          </button>

          <button
            onClick={() => setShowHighlights(!showHighlights)}
            className={`inline-flex items-center space-x-1 p-1.5 rounded-lg border transition-colors ${
              showHighlights
                ? 'bg-amber-50 border-amber-200 text-amber-800'
                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'
            }`}
            title="Toggle replacement preview highlights"
          >
            {showHighlights ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {isDrawMode && (
        <div className="bg-blue-50 px-4 py-2 text-xs text-blue-800 border-b border-blue-200 flex items-center justify-between">
          <span>🎯 Click and drag across any word or number on the PDF to select it for replacement.</span>
          <button
            onClick={() => setIsDrawMode(false)}
            className="text-blue-600 underline font-semibold ml-2"
          >
            Done
          </button>
        </div>
      )}

      {/* PDF Canvas Viewport Container */}
      <div
        ref={containerRef}
        className="relative overflow-auto bg-slate-100/70 p-6 flex items-center justify-center min-h-[460px] max-h-[750px]"
      >
        {isRendering && (
          <div className="absolute inset-0 bg-white/60 backdrop-blur-[1px] flex items-center justify-center z-20">
            <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
          </div>
        )}

        <div
          className={`relative shadow-lg rounded-md overflow-hidden bg-white ${
            isDrawMode ? 'cursor-crosshair' : 'cursor-default'
          }`}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
        >
          <canvas ref={canvasRef} className="block" />

          {/* Active drawing box */}
          {isDrawMode && dragStart && currentDrag && (
            <div
              className="absolute border-2 border-dashed border-blue-600 bg-blue-500/20 pointer-events-none z-30"
              style={{
                left: `${Math.min(dragStart.x, currentDrag.x)}px`,
                top: `${Math.min(dragStart.y, currentDrag.y)}px`,
                width: `${Math.abs(currentDrag.x - dragStart.x)}px`,
                height: `${Math.abs(currentDrag.y - dragStart.y)}px`,
              }}
            />
          )}

          {/* Live Replacement & Highlight Overlays */}
          {showHighlights && pageViewport && (
            <div
              className="absolute inset-0 pointer-events-none"
              style={{ width: pageViewport.width, height: pageViewport.height }}
            >
              {currentPageMatches.map((match, idx) => {
                const isReflow = Boolean(
                  match.isItemReflow &&
                  match.fullReplacedStr !== undefined &&
                  match.itemX !== undefined &&
                  match.itemY !== undefined
                );

                const targetX = isReflow ? match.itemX! : match.x;
                const targetY = isReflow ? match.itemY! : match.y;
                const targetWidth = isReflow ? (match.itemWidth || match.width) : match.width;
                const displayText = isReflow ? match.fullReplacedStr! : match.replaceText;

                const scaledX = targetX * scale;
                const scaledHeight = match.height * 1.35 * scale;
                const scaledWidth = Math.max(targetWidth * scale, 12);
                const scaledY = pageViewport.height - targetY * scale - match.height * 0.85 * scale;

                const fontCssFamily =
                  match.fontFamily === 'TimesRoman'
                    ? 'Georgia, serif'
                    : match.fontFamily === 'Courier'
                    ? 'Courier, monospace'
                    : 'Helvetica, Arial, sans-serif';

                return (
                  <div
                    key={idx}
                    className="absolute border border-blue-500/80 rounded-xs pointer-events-auto group transition-all"
                    style={{
                      left: `${scaledX - 1}px`,
                      top: `${scaledY - 2}px`,
                      width: `${scaledWidth + 3}px`,
                      height: `${scaledHeight + 4}px`,
                      backgroundColor: displayText ? match.maskColor : 'rgba(251, 191, 36, 0.25)',
                    }}
                  >
                    {/* Live Replacement Text directly in preview! */}
                    {displayText ? (
                      <span
                        className="absolute inset-0 flex items-center overflow-hidden px-0.5 whitespace-nowrap"
                        style={{
                          color: match.textColor,
                          fontFamily: fontCssFamily,
                          fontSize: `${match.fontSize * scale}px`,
                          fontWeight: match.isBold ? 700 : 400,
                          lineHeight: 1,
                        }}
                      >
                        {displayText}
                      </span>
                    ) : null}

                    {/* Tooltip on hover */}
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2.5 py-1 bg-slate-900 text-white text-[11px] rounded-lg shadow-xl whitespace-nowrap pointer-events-none z-30 flex items-center space-x-2">
                      <span className="font-semibold text-slate-300">&quot;{match.originalText}&quot;</span>
                      <span className="text-slate-400">&rarr;</span>
                      <span style={{ color: match.textColor }} className="font-bold">
                        {match.replaceText ? `"${match.replaceText}"` : '(Type replacement)'}
                      </span>
                      {match.isBold && (
                        <span className="text-[9px] px-1 py-0.5 rounded bg-blue-800 text-blue-200 font-bold">
                          BOLD
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
