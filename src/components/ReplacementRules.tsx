import React, { useState } from 'react';
import {
  Plus,
  Trash2,
  SlidersHorizontal,
  Check,
  ArrowRight,
  Crop,
  Type,
  Palette,
  Bold,
} from 'lucide-react';
import { ReplacementRule, FontFamilyChoice } from '../lib/pdfReplacer';
import { BulkImportModal } from './BulkImportModal';

interface ReplacementRulesProps {
  rules: ReplacementRule[];
  onChangeRule: (id: string, updated: Partial<ReplacementRule>) => void;
  onAddRule: () => void;
  onRemoveRule: (id: string) => void;
  onBulkImport: (newRules: ReplacementRule[]) => void;
  onClearRules: () => void;
  matchesByRule: Record<string, number>;
  isScanning: boolean;
}

export const ReplacementRules: React.FC<ReplacementRulesProps> = ({
  rules,
  onChangeRule,
  onAddRule,
  onRemoveRule,
  onBulkImport,
  onClearRules,
  matchesByRule,
  isScanning,
}) => {
  const [expandedRuleId, setExpandedRuleId] = useState<string | null>(null);
  const [isBulkModalOpen, setIsBulkModalOpen] = useState<boolean>(false);

  const toggleOptions = (id: string) => {
    setExpandedRuleId(expandedRuleId === id ? null : id);
  };

  return (
    <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Find & Replace Rules</h2>
          <p className="text-xs text-slate-500">
            Preserves original text color, font style, and natural text reflow.
          </p>
        </div>
        <div className="flex items-center space-x-2">
          {(rules.length > 1 || rules.some((r) => r.findText || r.replaceText || r.manualBox)) && (
            <button
              onClick={onClearRules}
              className="inline-flex items-center space-x-1 px-2.5 py-1.5 rounded-xl text-slate-500 hover:text-rose-600 hover:bg-rose-50 text-xs font-medium transition-colors"
              title="Clear all replacement rules"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Clear All</span>
            </button>
          )}
          <button
            onClick={() => setIsBulkModalOpen(true)}
            className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors"
            title="Paste multiple find and replace pairs"
          >
            <span>Paste Pairs</span>
          </button>
          <button
            onClick={onAddRule}
            className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-blue-50 text-blue-600 hover:bg-blue-100 text-xs font-semibold transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Rule</span>
          </button>
        </div>
      </div>

      <div className="space-y-3">
        {rules.map((rule, index) => {
          const matchCount = matchesByRule[rule.id] ?? 0;
          const isExpanded = expandedRuleId === rule.id;
          const isManualBox = Boolean(rule.manualBox);

          return (
            <div
              key={rule.id}
              className={`border rounded-xl p-3.5 transition-all space-y-3 ${
                isManualBox
                  ? 'border-blue-200 bg-blue-50/30 hover:border-blue-300'
                  : 'border-slate-200 bg-slate-50/50 hover:bg-white hover:border-slate-300'
              }`}
            >
              {isManualBox && (
                <div className="flex flex-wrap items-center justify-between gap-1 pb-1.5 border-b border-blue-100 text-xs">
                  <div className="flex items-center space-x-1.5 text-blue-800 font-semibold">
                    <Crop className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                    <span>Selected PDF Area &bull; Page {(rule.manualBox?.pageIndex ?? 0) + 1}</span>
                  </div>
                  <span className="text-[11px] text-blue-700 bg-blue-100/70 px-2 py-0.5 rounded-full font-medium">
                    {rule.findText.trim().length > 0 && rule.findText !== 'Selected Area'
                      ? 'Replaces specific word in area'
                      : 'Replaces whole box'}
                  </span>
                </div>
              )}

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                {/* Index / Type indicator */}
                <div
                  className={`hidden sm:flex w-6 h-6 rounded-full items-center justify-center text-xs font-semibold shrink-0 ${
                    isManualBox
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-200 text-slate-600'
                  }`}
                  title={isManualBox ? 'Manually selected area on page' : `Rule #${index + 1}`}
                >
                  {isManualBox ? <Crop className="w-3.5 h-3.5" /> : index + 1}
                </div>

                {/* Find input */}
                <div className="flex-1 relative">
                  <input
                    type="text"
                    value={rule.findText === 'Selected Area' ? '' : rule.findText}
                    onChange={(e) => onChangeRule(rule.id, { findText: e.target.value })}
                    placeholder={
                      isManualBox
                        ? 'Word in this area (or leave blank for whole box)'
                        : 'Word to find (e.g. Ankit)'
                    }
                    className="w-full text-sm px-3 py-2 bg-white rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 placeholder:text-slate-400"
                  />
                </div>

                <div className="hidden sm:flex items-center justify-center text-slate-400">
                  <ArrowRight className="w-4 h-4" />
                </div>

                {/* Replace input */}
                <div className="flex-1 relative">
                  <input
                    type="text"
                    value={rule.replaceText}
                    onChange={(e) => onChangeRule(rule.id, { replaceText: e.target.value })}
                    placeholder="Replace with (e.g. Buny)"
                    className="w-full text-sm px-3 py-2 bg-white rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 placeholder:text-slate-400 font-medium"
                  />
                </div>

                {/* Controls & Match badge */}
                <div className="flex items-center justify-between sm:justify-end space-x-2 pt-1 sm:pt-0">
                  {rule.findText.trim().length > 0 && rule.findText !== 'Selected Area' && (
                    <span
                      className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-medium ${
                        matchCount > 0
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-amber-50 text-amber-700 border border-amber-200'
                      }`}
                    >
                      {matchCount > 0 ? (
                        <>
                          <Check className="w-3 h-3 mr-1" />
                          {matchCount} {isManualBox ? 'in area' : 'found'}
                        </>
                      ) : (
                        isManualBox ? '0 in area' : '0 found'
                      )}
                    </span>
                  )}

                  <button
                    type="button"
                    onClick={() => toggleOptions(rule.id)}
                    className={`p-2 rounded-lg text-xs font-medium border transition-colors ${
                      isExpanded
                        ? 'bg-blue-50 border-blue-200 text-blue-600'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                    title="Font, Color & Style Options"
                  >
                    <SlidersHorizontal className="w-3.5 h-3.5" />
                  </button>

                  {rules.length > 1 && (
                    <button
                      type="button"
                      onClick={() => onRemoveRule(rule.id)}
                      className="p-2 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-100 transition-colors"
                      title="Remove this rule"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Quick-pick words inside this selected area */}
              {isManualBox && rule.manualBox?.wordsInside && rule.manualBox.wordsInside.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  <span className="text-[11px] text-slate-500 font-medium">Click word in area:</span>
                  {rule.manualBox.wordsInside.slice(0, 12).map((w, wIdx) => (
                    <button
                      key={wIdx}
                      type="button"
                      onClick={() => onChangeRule(rule.id, { findText: w })}
                      className={`text-[11px] px-2 py-0.5 rounded-md border transition-colors ${
                        rule.findText === w
                          ? 'bg-blue-600 text-white border-blue-600 font-semibold shadow-2xs'
                          : 'bg-white text-slate-700 border-slate-200 hover:border-blue-300 hover:bg-blue-50'
                      }`}
                      title={`Select "${w}" to replace in this area`}
                    >
                      {w}
                    </button>
                  ))}
                </div>
              )}

              {/* Advanced options accordion */}
              {isExpanded && (
                <div className="pt-3 border-t border-slate-200/80 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-slate-600">
                  {/* Font Family selector */}
                  <div className="flex flex-col space-y-1 bg-white p-2.5 rounded-lg border border-slate-200">
                    <span className="font-medium text-slate-500 text-[11px]">Font Family:</span>
                    <select
                      value={rule.fontFamily || 'auto'}
                      onChange={(e) =>
                        onChangeRule(rule.id, {
                          fontFamily: e.target.value as FontFamilyChoice,
                        })
                      }
                      className="bg-transparent border border-slate-200 rounded px-2 py-1 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    >
                      <option value="auto">✨ Auto (Match Original Font)</option>
                      <option value="Helvetica">Helvetica (Clean Sans-Serif)</option>
                      <option value="TimesRoman">Times Roman (Classic Serif)</option>
                      <option value="Courier">Courier (Receipt / Monospace)</option>
                    </select>
                  </div>

                  {/* Text Color selector */}
                  <div className="flex flex-col space-y-1 bg-white p-2.5 rounded-lg border border-slate-200">
                    <span className="font-medium text-slate-500 text-[11px]">Text Color:</span>
                    <div className="flex items-center space-x-2">
                      <select
                        value={rule.textColor === 'auto' || !rule.textColor ? 'auto' : 'custom'}
                        onChange={(e) =>
                          onChangeRule(rule.id, {
                            textColor: e.target.value === 'auto' ? 'auto' : '#000000',
                          })
                        }
                        className="bg-transparent border border-slate-200 rounded px-2 py-1 text-xs text-slate-800 focus:outline-none flex-1"
                      >
                        <option value="auto">✨ Auto (Match Original Color)</option>
                        <option value="custom">Custom Color...</option>
                      </select>

                      {rule.textColor !== 'auto' && rule.textColor && (
                        <input
                          type="color"
                          value={rule.textColor}
                          onChange={(e) => onChangeRule(rule.id, { textColor: e.target.value })}
                          className="w-7 h-7 rounded cursor-pointer border border-slate-200 p-0.5"
                          title="Pick custom text color"
                        />
                      )}
                    </div>
                  </div>

                  {/* Font size adjustment */}
                  <div className="flex items-center justify-between bg-white p-2.5 rounded-lg border border-slate-200">
                    <div>
                      <span className="font-medium text-slate-500 text-[11px] block">Size Fine-tune:</span>
                      <span className="text-slate-400 text-[10px]">Auto-scaled to fit</span>
                    </div>
                    <div className="flex items-center space-x-1.5">
                      <button
                        type="button"
                        onClick={() =>
                          onChangeRule(rule.id, {
                            fontSizeAdjustment: (rule.fontSizeAdjustment || 0) - 1,
                          })
                        }
                        className="w-6 h-6 rounded bg-slate-100 text-slate-700 hover:bg-slate-200 flex items-center justify-center font-bold"
                      >
                        -
                      </button>
                      <span className="w-8 text-center font-semibold text-slate-800">
                        {(rule.fontSizeAdjustment || 0) > 0
                          ? `+${rule.fontSizeAdjustment}`
                          : rule.fontSizeAdjustment || 0}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          onChangeRule(rule.id, {
                            fontSizeAdjustment: (rule.fontSizeAdjustment || 0) + 1,
                          })
                        }
                        className="w-6 h-6 rounded bg-slate-100 text-slate-700 hover:bg-slate-200 flex items-center justify-center font-bold"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  {/* Paper / Background Mask color */}
                  <div className="flex flex-col space-y-1 bg-white p-2.5 rounded-lg border border-slate-200">
                    <span className="font-medium text-slate-500 text-[11px]">Paper/Mask Color:</span>
                    <div className="flex items-center space-x-2">
                      <select
                        value={rule.maskColor === 'auto' || !rule.maskColor ? 'auto' : 'custom'}
                        onChange={(e) =>
                          onChangeRule(rule.id, {
                            maskColor: e.target.value === 'auto' ? 'auto' : '#ffffff',
                          })
                        }
                        className="bg-transparent border border-slate-200 rounded px-2 py-1 text-xs text-slate-800 focus:outline-none flex-1"
                      >
                        <option value="auto">✨ Auto (Sample Paper/Page)</option>
                        <option value="custom">Custom Color...</option>
                      </select>

                      {rule.maskColor !== 'auto' && rule.maskColor && (
                        <input
                          type="color"
                          value={rule.maskColor}
                          onChange={(e) => onChangeRule(rule.id, { maskColor: e.target.value })}
                          className="w-7 h-7 rounded cursor-pointer border border-slate-200 p-0.5"
                          title="Pick custom mask background color"
                        />
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <BulkImportModal
        isOpen={isBulkModalOpen}
        onClose={() => setIsBulkModalOpen(false)}
        onImport={(newRules) => {
          onBulkImport(newRules);
          setIsBulkModalOpen(false);
        }}
      />
    </div>
  );
};
