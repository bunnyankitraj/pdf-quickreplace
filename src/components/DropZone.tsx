import React, { useRef, useState } from 'react';
import { UploadCloud, FileText, CheckCircle2, RotateCcw, Sparkles } from 'lucide-react';
import { createSampleInvoicePdf } from '../lib/pdfHelper';
import { pdfjsLib } from '../lib/pdfWorker';

interface DropZoneProps {
  fileName: string | null;
  fileSize: number | null;
  pageCount: number | null;
  onFileLoaded: (bytes: Uint8Array, fileName: string, pageCount: number) => void;
  onReset: () => void;
  isLoading: boolean;
}

export const DropZone: React.FC<DropZoneProps> = ({
  fileName,
  fileSize,
  pageCount,
  onFileLoaded,
  onReset,
  isLoading,
}) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const handleProcessFile = async (file: File) => {
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      alert('Please select a valid PDF file.');
      return;
    }

    const arrayBuffer = await file.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    
    // Quick peek to count pages using pdfjs
    const doc = await pdfjsLib.getDocument({ data: bytes.slice(0) }).promise;
    
    onFileLoaded(bytes, file.name, doc.numPages);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleProcessFile(e.dataTransfer.files[0]);
    }
  };

  const handleSamplePdf = async () => {
    const bytes = await createSampleInvoicePdf();
    const doc = await pdfjsLib.getDocument({ data: bytes.slice(0) }).promise;
    onFileLoaded(bytes, 'sample_invoice.pdf', doc.numPages);
  };

  if (fileName) {
    return (
      <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center space-x-4 w-full sm:w-auto">
          <div className="w-12 h-12 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 shrink-0">
            <FileText className="w-6 h-6" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center space-x-2">
              <h3 className="text-sm font-semibold text-slate-800 truncate">{fileName}</h3>
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-700">
                {pageCount} {pageCount === 1 ? 'page' : 'pages'}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              {fileSize ? formatBytes(fileSize) : 'In-memory'} &bull; Ready for text replacement
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2 w-full sm:w-auto justify-end">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
          >
            Change File
          </button>
          <button
            onClick={onReset}
            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
            title="Remove file"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf"
            className="hidden"
            onChange={(e) => {
              if (e.target.files && e.target.files[0]) {
                handleProcessFile(e.target.files[0]);
              }
            }}
          />
        </div>
      </div>
    );
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragOver(true);
      }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={handleDrop}
      className={`border-2 border-dashed rounded-2xl p-8 sm:p-12 text-center transition-all bg-white ${
        isDragOver
          ? 'border-blue-500 bg-blue-50/50 scale-[0.99]'
          : 'border-slate-300 hover:border-blue-400'
      }`}
    >
      <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100">
        <UploadCloud className="w-8 h-8" />
      </div>

      <h3 className="text-lg font-semibold text-slate-800 mb-1">
        Choose a PDF or drag & drop it here
      </h3>
      <p className="text-sm text-slate-500 max-w-md mx-auto mb-6">
        No size limits, completely private. Your document is processed locally in your browser and never uploaded anywhere.
      </p>

      <div className="flex flex-wrap items-center justify-center gap-3">
        <button
          disabled={isLoading}
          onClick={() => fileInputRef.current?.click()}
          className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-xl shadow-sm transition-all hover:shadow"
        >
          {isLoading ? 'Loading PDF...' : 'Browse Computer'}
        </button>

        <button
          disabled={isLoading}
          onClick={handleSamplePdf}
          className="inline-flex items-center space-x-1.5 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium rounded-xl transition-all"
        >
          <Sparkles className="w-4 h-4 text-amber-500" />
          <span>Try Demo Invoice</span>
        </button>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={(e) => {
          if (e.target.files && e.target.files[0]) {
            handleProcessFile(e.target.files[0]);
          }
        }}
      />
    </div>
  );
};
