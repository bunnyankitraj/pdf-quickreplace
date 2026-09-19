import React, { useState } from 'react';
import { X, ClipboardPaste, ArrowRight } from 'lucide-react';
import { ReplacementRule } from '../lib/pdfReplacer';

interface BulkImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (newRules: ReplacementRule[]) => void;
}

export const BulkImportModal: React.FC<BulkImportModalProps> = ({
  isOpen,
  onClose,
  onImport,
}) => {
  const [text, setText] = useState<string>('');

  if (!isOpen) return null;

  const handleParseAndImport = () => {
    const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
    const parsed: ReplacementRule[] = [];

    for (const line of lines) {
      let find = '';
      let replace = '';

      if (line.includes('->')) {
        const parts = line.split('->');
        find = parts[0].trim();
        replace = parts.slice(1).join('->').trim();
      } else if (line.includes('=')) {
        const parts = line.split('=');
        find = parts[0].trim();
        replace = parts.slice(1).join('=').trim();
      } else if (line.includes(',')) {
        const parts = line.split(',');
        find = parts[0].trim();
        replace = parts.slice(1).join(',').trim();
      } else {
        find = line.trim();
        replace = '';
      }

      if (find) {
        parsed.push({
          id: `rule-bulk-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          findText: find,
          replaceText: replace,
          caseSensitive: false,
          matchWholeWord: false,
          maskColor: 'auto',
          textColor: 'auto',
          fontFamily: 'auto',
          isBold: 'auto',
        });
      }
    }

    if (parsed.length > 0) {
      onImport(parsed);
      setText('');
      onClose();
    } else {
      alert('Please enter at least one find and replace pair (e.g. "Old Name -> New Name").');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
      <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <ClipboardPaste className="w-4 h-4" />
            </div>
            <h3 className="text-base font-semibold text-slate-900">Bulk Import Rules</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-2 text-xs text-slate-600">
          <p>
            Paste your word replacement pairs below. One pair per line using{' '}
            <code className="bg-slate-100 px-1 py-0.5 rounded text-blue-600 font-mono">-&gt;</code>,{' '}
            <code className="bg-slate-100 px-1 py-0.5 rounded text-blue-600 font-mono">=</code>, or commas.
          </p>
          <div className="bg-slate-50 p-2.5 rounded-lg font-mono text-[11px] text-slate-500 space-y-0.5 border border-slate-200">
            <div>Bengaluru -&gt; Silchar</div>
            <div>Karnataka -&gt; Assam</div>
            <div>Ankit -&gt; Buny</div>
          </div>
        </div>

        <textarea
          rows={6}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={`Bengaluru -> Silchar\nKarnataka -> Assam\nAnkit -> Buny`}
          className="w-full text-xs font-mono p-3 bg-slate-50 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 placeholder:text-slate-400"
        />

        <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-100">
          <button
            onClick={onClose}
            className="px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleParseAndImport}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors flex items-center space-x-1.5"
          >
            <span>Import Rules</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
