import React, { useState, useEffect, useRef } from 'react';
import { Header } from './components/Header';
import { DropZone } from './components/DropZone';
import { ReplacementRules } from './components/ReplacementRules';
import { PdfPreview } from './components/PdfPreview';
import { HelpModal } from './components/HelpModal';
import {
  ReplacementRule,
  ReplacementStats,
  ManualBox,
  findMatchesInPdf,
  replaceTextInPdf,
} from './lib/pdfReplacer';
import { OcrWord } from './lib/ocrService';
import { Download, Loader2, CheckCircle2, Layers } from 'lucide-react';

export const App: React.FC = () => {
  const [pdfBytes, setPdfBytes] = useState<Uint8Array | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [pageCount, setPageCount] = useState<number | null>(null);
  const [fileSize, setFileSize] = useState<number | null>(null);
  const [isScannedPdf, setIsScannedPdf] = useState<boolean>(false);

  const [ocrWordsByPage, setOcrWordsByPage] = useState<Map<number, OcrWord[]>>(new Map());

  const [rules, setRules] = useState<ReplacementRule[]>([
    {
      id: 'rule-1',
      findText: '',
      replaceText: '',
      caseSensitive: false,
      matchWholeWord: false,
      maskColor: 'auto',
      textColor: 'auto',
      fontFamily: 'auto',
      isBold: 'auto',
    },
  ]);

  const [stats, setStats] = useState<ReplacementStats | null>(null);
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [isHelpOpen, setIsHelpOpen] = useState<boolean>(false);
  const [downloadSuccess, setDownloadSuccess] = useState<{
    count: number;
    fileName: string;
  } | null>(null);

  const debounceTimerRef = useRef<any>(null);

  // Trigger scanning when PDF, rules, or OCR cache changes
  useEffect(() => {
    if (!pdfBytes) {
      setStats(null);
      setIsScannedPdf(false);
      return;
    }

    const hasActiveRule = rules.some(
      (r) => r.findText.trim().length > 0 || r.manualBox
    );

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    setIsScanning(true);
    debounceTimerRef.current = setTimeout(async () => {
      try {
        const result = await findMatchesInPdf(pdfBytes, rules, ocrWordsByPage);
        setStats(result);
        if (result.isScannedPdf !== undefined) {
          setIsScannedPdf(result.isScannedPdf);
        }
      } catch (err) {
        console.error('Error scanning PDF:', err);
      } finally {
        setIsScanning(false);
      }
    }, 300);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [pdfBytes, rules, ocrWordsByPage]);

  const handleFileLoaded = (bytes: Uint8Array, name: string, pages: number) => {
    setPdfBytes(bytes);
    setFileName(name);
    setPageCount(pages);
    setFileSize(bytes.byteLength);
    setOcrWordsByPage(new Map());
    setDownloadSuccess(null);

    // If it's the demo invoice, prepopulate with example rules
    if (name === 'sample_invoice.pdf') {
      setRules([
        {
          id: 'rule-1',
          findText: 'Acme Corporation',
          replaceText: 'Alpha Global Tech',
          caseSensitive: false,
          matchWholeWord: false,
          maskColor: '#ffffff',
          textColor: '#0f172a',
        },
        {
          id: 'rule-2',
          findText: '$1,250.00',
          replaceText: '$890.00',
          caseSensitive: false,
          matchWholeWord: false,
          maskColor: '#ffffff',
          textColor: '#1e40af',
        },
        {
          id: 'rule-3',
          findText: 'October 14, 2023',
          replaceText: 'March 20, 2026',
          caseSensitive: false,
          matchWholeWord: false,
          maskColor: '#ffffff',
          textColor: '#334155',
        },
      ]);
    } else {
      setRules([
        {
          id: `rule-${Date.now()}`,
          findText: '',
          replaceText: '',
          caseSensitive: false,
          matchWholeWord: false,
          maskColor: 'auto',
          textColor: 'auto',
          fontFamily: 'auto',
          isBold: 'auto',
        },
      ]);
    }
  };

  const handleReset = () => {
    setPdfBytes(null);
    setFileName(null);
    setPageCount(null);
    setFileSize(null);
    setStats(null);
    setIsScannedPdf(false);
    setOcrWordsByPage(new Map());
    setDownloadSuccess(null);
  };

  const handleOcrCompleted = (pageIdx: number, words: OcrWord[]) => {
    setOcrWordsByPage((prev) => {
      const next = new Map(prev);
      next.set(pageIdx, words);
      return next;
    });
  };

  const handleManualBoxCreated = (box: ManualBox) => {
    const newRule: ReplacementRule = {
      id: `rule-box-${Date.now()}`,
      findText: 'Selected Area',
      replaceText: '',
      caseSensitive: false,
      matchWholeWord: false,
      maskColor: box.sampledColor || 'auto',
      textColor: box.sampledTextColor || 'auto',
      fontFamily: box.fontFamily || 'auto',
      isBold: 'auto',
      manualBox: box,
    };

    setRules((prev) => [...prev, newRule]);
  };

  const handleAddRule = () => {
    setRules((prev) => [
      ...prev,
      {
        id: `rule-${Date.now()}`,
        findText: '',
        replaceText: '',
        caseSensitive: false,
        matchWholeWord: false,
        maskColor: 'auto',
        textColor: 'auto',
        fontFamily: 'auto',
        isBold: 'auto',
      },
    ]);
  };

  const handleRemoveRule = (id: string) => {
    setRules((prev) => prev.filter((r) => r.id !== id));
  };

  const handleChangeRule = (id: string, updated: Partial<ReplacementRule>) => {
    setRules((prev) =>
      prev.map((r) => (r.id === id ? { ...r, ...updated } : r))
    );
  };

  const handleReplaceAndDownload = async () => {
    if (!pdfBytes || !fileName) return;

    setIsProcessing(true);
    try {
      const { modifiedBytes, stats: finalStats } = await replaceTextInPdf(
        pdfBytes,
        rules,
        ocrWordsByPage
      );

      const blob = new Blob([modifiedBytes as any], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);

      const baseName = fileName.replace(/\.[^/.]+$/, '');
      const downloadName = `${baseName}_edited.pdf`;

      const link = document.createElement('a');
      link.href = url;
      link.download = downloadName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setDownloadSuccess({
        count: finalStats.totalMatches,
        fileName: downloadName,
      });
    } catch (err) {
      console.error('Replacement failed:', err);
      alert('An error occurred while replacing text in the PDF.');
    } finally {
      setIsProcessing(false);
    }
  };

  const totalMatches = stats?.totalMatches ?? 0;
  const hasActiveRules = rules.some(
    (r) => r.findText.trim().length > 0 || r.manualBox
  );

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Header onOpenHelp={() => setIsHelpOpen(true)} />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Upload Zone */}
        <DropZone
          fileName={fileName}
          fileSize={fileSize}
          pageCount={pageCount}
          onFileLoaded={handleFileLoaded}
          onReset={handleReset}
          isLoading={false}
        />

        {/* Action and Editor Area if PDF is loaded */}
        {pdfBytes && pageCount && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Left Column: Replacement Rules & Execution */}
            <div className="lg:col-span-5 space-y-6">
              <ReplacementRules
                rules={rules}
                onChangeRule={handleChangeRule}
                onAddRule={handleAddRule}
                onRemoveRule={handleRemoveRule}
                matchesByRule={stats?.matchesByRule ?? {}}
                isScanning={isScanning}
              />

              {/* Action Box */}
              <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <div className="flex items-center space-x-1.5">
                    <Layers className="w-4 h-4 text-slate-400" />
                    <span>Total Matches Found:</span>
                  </div>
                  <span className="font-semibold text-slate-800 text-sm">
                    {isScanning ? (
                      <span className="inline-flex items-center text-slate-400">
                        <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> Scanning...
                      </span>
                    ) : (
                      `${totalMatches} ${totalMatches === 1 ? 'word' : 'words'}`
                    )}
                  </span>
                </div>

                {downloadSuccess && (
                  <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start space-x-2.5 text-emerald-800 text-xs animate-in fade-in">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-semibold">Successfully Downloaded!</span>
                      <p className="text-emerald-700 mt-0.5">
                        Replaced {downloadSuccess.count} instances and downloaded{' '}
                        <code className="font-mono">{downloadSuccess.fileName}</code>.
                      </p>
                    </div>
                  </div>
                )}

                <button
                  disabled={isProcessing || !hasActiveRules}
                  onClick={handleReplaceAndDownload}
                  className="w-full py-3.5 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold text-sm rounded-xl shadow-md shadow-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center space-x-2"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span>Generating & Downloading PDF...</span>
                    </>
                  ) : (
                    <>
                      <Download className="w-5 h-5" />
                      <span>Replace & Download PDF</span>
                    </>
                  )}
                </button>

                <p className="text-[11px] text-center text-slate-400">
                  Runs directly in your browser. Download begins immediately upon completion.
                </p>
              </div>
            </div>

            {/* Right Column: PDF Preview & Match Highlights */}
            <div className="lg:col-span-7">
              <PdfPreview
                pdfBytes={pdfBytes}
                pageCount={pageCount}
                occurrences={stats?.occurrences ?? []}
                isScannedPdf={isScannedPdf}
                onOcrCompleted={handleOcrCompleted}
                onManualBoxCreated={handleManualBoxCreated}
              />
            </div>
          </div>
        )}
      </main>

      <footer className="border-t border-slate-200 bg-white py-6 mt-12 text-center text-xs text-slate-500">
        <p>
          PDF QuickReplace &bull; Free, Open &amp; Client-Side PDF Text Editor &bull; Built with React, Tesseract.js &amp; pdf-lib
        </p>
      </footer>

      <HelpModal isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} />
    </div>
  );
};

export default App;
