import React from 'react';
import { X, ShieldCheck, Zap, Globe, Sparkles } from 'lucide-react';

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const HelpModal: React.FC<HelpModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
      <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-5 animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center">
              <Sparkles className="w-4 h-4" />
            </div>
            <h3 className="text-base font-semibold text-slate-900">About PDF QuickReplace</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4 text-sm text-slate-600">
          <div className="flex items-start space-x-3">
            <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <h4 className="font-semibold text-slate-800">100% Client-Side Privacy</h4>
              <p className="text-xs text-slate-500 mt-0.5">
                Your PDF file never touches a server. All parsing, text detection, and PDF generation happen directly inside your browser using WebAssembly and pure JavaScript.
              </p>
            </div>
          </div>

          <div className="flex items-start space-x-3">
            <Zap className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
            <div>
              <h4 className="font-semibold text-slate-800">How Text Replacement Works</h4>
              <p className="text-xs text-slate-500 mt-0.5">
                PDFs are print-fixed documents. The app locates the exact bounding box coordinates of your target words, applies a clean background mask, and draws your replacement text at the identical position with matching font metrics.
              </p>
            </div>
          </div>

          <div className="flex items-start space-x-3">
            <Globe className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
            <div>
              <h4 className="font-semibold text-slate-800">Deploying for Free ($0 Forever)</h4>
              <p className="text-xs text-slate-500 mt-0.5">
                Because there is zero backend code, you can host this website completely free on:
              </p>
              <ul className="text-xs text-slate-600 list-disc list-inside mt-1 space-y-1">
                <li><strong>Vercel</strong>: Connect your GitHub repo or run <code className="bg-slate-100 px-1 py-0.5 rounded">vercel deploy</code></li>
                <li><strong>GitHub Pages</strong>: Push your code and enable GitHub Pages under repo Settings</li>
                <li><strong>Netlify / Cloudflare Pages</strong>: Drag & drop the <code className="bg-slate-100 px-1 py-0.5 rounded">dist</code> folder</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="pt-3 border-t border-slate-100 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl transition-colors"
          >
            Got it, thanks!
          </button>
        </div>
      </div>
    </div>
  );
};
