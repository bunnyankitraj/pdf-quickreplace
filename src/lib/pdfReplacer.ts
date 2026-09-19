import { PDFDocument, StandardFonts, rgb, RGB } from 'pdf-lib';
import { pdfjsLib } from './pdfWorker';
import { OcrWord } from './ocrService';

export interface ManualBox {
  pageIndex: number;
  pdfX: number;
  pdfY: number;
  pdfWidth: number;
  pdfHeight: number;
  sampledColor?: string;
  sampledTextColor?: string;
  fontFamily?: FontFamilyChoice;
}

export type FontFamilyChoice = 'auto' | 'Helvetica' | 'Courier' | 'TimesRoman';

export interface ReplacementRule {
  id: string;
  findText: string;
  replaceText: string;
  caseSensitive: boolean;
  matchWholeWord: boolean;
  maskColor?: string;
  textColor?: string;
  fontFamily?: FontFamilyChoice;
  isBold?: boolean | 'auto';
  fontSizeAdjustment?: number;
  manualBox?: ManualBox;
}

export interface MatchOccurrence {
  ruleId: string;
  pageIndex: number; // 0-based
  x: number;
  y: number; // PDF baseline coordinates (from bottom)
  width: number;
  height: number;
  fontSize: number;
  originalText: string;
  replaceText: string;
  maskColor: string;
  textColor: string;
  fontFamily: 'Helvetica' | 'Courier' | 'TimesRoman';
  isBold: boolean;
  // Whole-line/item reflow data for natural text movement
  isItemReflow?: boolean;
  itemKey?: string;
  itemX?: number;
  itemY?: number;
  itemWidth?: number;
  fullOriginalStr?: string;
  fullReplacedStr?: string;
}

export interface ReplacementStats {
  totalMatches: number;
  matchesByRule: Record<string, number>;
  pagesAffected: number;
  occurrences: MatchOccurrence[];
  isScannedPdf?: boolean;
}

export function hexToRgb(hex: string): RGB {
  const cleanHex = hex.replace('#', '');
  const bigint = parseInt(cleanHex, 16);
  const r = ((bigint >> 16) & 255) / 255;
  const g = ((bigint >> 8) & 255) / 255;
  const b = (bigint & 255) / 255;
  return rgb(isNaN(r) ? 1 : r, isNaN(g) ? 1 : g, isNaN(b) ? 1 : b);
}

interface TextOpSnippet {
  str: string;
  color: string;
}

/**
 * Extracts text snippets with their exact fill colors from the page operator list.
 */
function extractColorsFromOpList(opList: any, OPS: any): TextOpSnippet[] {
  const snippets: TextOpSnippet[] = [];
  let currentColor = '#000000';

  for (let i = 0; i < opList.fnArray.length; i++) {
    const fn = opList.fnArray[i];
    const args = opList.argsArray[i];

    if (fn === OPS.setFillRGBColor) {
      const [r, g, b] = args;
      currentColor = '#' + [r, g, b].map((v: number) => v.toString(16).padStart(2, '0')).join('');
    } else if (fn === OPS.setFillGray) {
      const v = Math.round(args[0] * 255);
      currentColor = '#' + [v, v, v].map((x: number) => x.toString(16).padStart(2, '0')).join('');
    } else if (fn === OPS.showText || fn === OPS.showSpacedText) {
      let str = '';
      if (Array.isArray(args[0])) {
        str = args[0]
          .map((c: any) => (typeof c === 'string' ? c : c?.unicode || ''))
          .join('');
      } else if (typeof args[0] === 'string') {
        str = args[0];
      }
      if (str) {
        snippets.push({ str, color: currentColor });
      }
    }
  }

  return snippets;
}

function findColorForText(
  itemText: string,
  snippets: TextOpSnippet[],
  defaultColor = '#000000'
): string {
  const clean = itemText.replace(/\s+/g, '');
  if (!clean) return defaultColor;

  for (const s of snippets) {
    const sClean = s.str.replace(/\s+/g, '');
    if (sClean.includes(clean) || clean.includes(sClean)) {
      return s.color;
    }
  }
  return defaultColor;
}

/**
 * Resolves font family and bold weight using commonObjs and font descriptors.
 */
function resolveFontDetails(
  fontName: string,
  commonObjs?: any,
  styles?: Record<string, any>
): { family: 'Helvetica' | 'Courier' | 'TimesRoman'; isBold: boolean } {
  let realName = fontName || '';
  if (commonObjs) {
    try {
      const obj = commonObjs.get(fontName);
      if (obj?.name) {
        realName = obj.name;
      }
    } catch {
      // ignore
    }
  }

  const lowerName = realName.toLowerCase();
  const style = styles ? styles[fontName] : null;
  const styleFamily = (style?.fontFamily || '').toLowerCase();

  // Determine boldness
  const isBold = Boolean(lowerName.match(/bold|black|heavy|w[6-9]|medi/i));

  // Determine family: Sans (Helvetica), Serif (Times), Monospace (Courier)
  let family: 'Helvetica' | 'Courier' | 'TimesRoman' = 'Helvetica';
  if (lowerName.includes('sans') || styleFamily.includes('sans')) {
    family = 'Helvetica';
  } else if (lowerName.includes('serif') || lowerName.includes('times') || lowerName.includes('roman') || styleFamily.includes('serif')) {
    family = 'TimesRoman';
  } else if (lowerName.includes('mono') || lowerName.includes('courier') || styleFamily.includes('monospace')) {
    family = 'Courier';
  }

  return { family, isBold };
}

/**
 * Scans the PDF and discovers all matching text positions across all pages,
 * with full-line reflow to eliminate gaps and shift text naturally.
 */
export async function findMatchesInPdf(
  pdfBytes: Uint8Array,
  rules: ReplacementRule[],
  ocrWordsByPage?: Map<number, OcrWord[]>
): Promise<ReplacementStats> {
  const activeRules = rules.filter((r) => r.findText.trim().length > 0 || r.manualBox);
  const occurrences: MatchOccurrence[] = [];
  const matchesByRule: Record<string, number> = {};
  rules.forEach((r) => (matchesByRule[r.id] = 0));

  if (activeRules.length === 0) {
    return {
      totalMatches: 0,
      matchesByRule,
      pagesAffected: 0,
      occurrences: [],
      isScannedPdf: false,
    };
  }

  // 1. Handle manual box selections
  for (const rule of activeRules) {
    if (rule.manualBox) {
      const box = rule.manualBox;
      const baseFontSize = Math.max(box.pdfHeight * 0.75, 8);
      const adjustedFontSize = Math.max(4, baseFontSize + (rule.fontSizeAdjustment || 0));

      const chosenFont: 'Helvetica' | 'Courier' | 'TimesRoman' =
        rule.fontFamily && rule.fontFamily !== 'auto'
          ? rule.fontFamily
          : (box.fontFamily && box.fontFamily !== 'auto' ? box.fontFamily : 'Courier');

      const chosenColor =
        rule.textColor && rule.textColor !== 'auto'
          ? rule.textColor
          : (box.sampledTextColor || '#000000');

      const chosenMask =
        rule.maskColor && rule.maskColor !== 'auto'
          ? rule.maskColor
          : (box.sampledColor || '#ffffff');

      occurrences.push({
        ruleId: rule.id,
        pageIndex: box.pageIndex,
        x: box.pdfX,
        y: box.pdfY + box.pdfHeight * 0.15,
        width: box.pdfWidth,
        height: box.pdfHeight,
        fontSize: adjustedFontSize,
        originalText: rule.findText || 'Selected Area',
        replaceText: rule.replaceText,
        maskColor: chosenMask,
        textColor: chosenColor,
        fontFamily: chosenFont,
        isBold: rule.isBold === true,
        isItemReflow: false,
      });
      matchesByRule[rule.id] = (matchesByRule[rule.id] || 0) + 1;
    }
  }

  // 2. Scan PDF with pdfjs
  const loadingTask = pdfjsLib.getDocument({ data: pdfBytes.slice(0) });
  const pdfDoc = await loadingTask.promise;
  const pagesWithMatches = new Set<number>();
  let totalDigitalTextItems = 0;

  for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
    const page = await pdfDoc.getPage(pageNum);
    const pageIndex = pageNum - 1;

    // Load operator list FIRST to populate commonObjs and extract font colors!
    let opSnippets: TextOpSnippet[] = [];
    try {
      const opList = await page.getOperatorList();
      opSnippets = extractColorsFromOpList(opList, pdfjsLib.OPS);
    } catch {
      opSnippets = [];
    }

    const commonObjs = (page as any).commonObjs;
    const textContent = await page.getTextContent();
    totalDigitalTextItems += textContent.items.length;

    // A. Digital text search with whole-item reflow
    let itemIdx = 0;
    for (const item of textContent.items) {
      itemIdx++;
      if (!('str' in item) || !item.str) continue;

      const itemStr = item.str;
      const transform = item.transform; // [scaleX, skewY, skewX, scaleY, tx, ty]
      const tx = transform[4];
      const ty = transform[5];

      const fontSize = Math.max(
        Math.hypot(transform[0], transform[1]),
        Math.abs(transform[3]),
        item.height || 10
      );

      const { family: origFamily, isBold: origIsBold } = resolveFontDetails(
        item.fontName,
        commonObjs,
        textContent.styles
      );

      const origTextColor = findColorForText(itemStr, opSnippets, '#000000');

      let currentItemStr = itemStr;
      let hasReplacementMatch = false;
      let firstReplacementRule: ReplacementRule | null = null;
      let matchedWord = '';

      for (const rule of activeRules) {
        if (!rule.findText.trim() || rule.manualBox) continue;

        const escaped = rule.findText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const pattern = rule.matchWholeWord ? `\\b${escaped}\\b` : escaped;
        const flags = rule.caseSensitive ? 'g' : 'gi';
        let regex: RegExp;
        try {
          regex = new RegExp(pattern, flags);
        } catch {
          continue;
        }

        const isReplacing = rule.replaceText.trim().length > 0;

        if (isReplacing) {
          if (regex.test(currentItemStr)) {
            hasReplacementMatch = true;
            if (!firstReplacementRule) firstReplacementRule = rule;

            regex.lastIndex = 0;
            const matches = currentItemStr.match(regex);
            if (matches) {
              matchesByRule[rule.id] = (matchesByRule[rule.id] || 0) + matches.length;
              matchedWord = matches[0];
            }

            currentItemStr = currentItemStr.replace(regex, rule.replaceText);
          }
        } else {
          // User is just typing/finding - ONLY highlight the matched substring, DO NOT reflow or erase!
          let match: RegExpExecArray | null;
          while ((match = regex.exec(itemStr)) !== null) {
            matchesByRule[rule.id] = (matchesByRule[rule.id] || 0) + 1;

            const matchIndex = match.index;
            const matchText = match[0];
            const matchLen = matchText.length;

            let subX = tx;
            let subWidth = item.width;
            if (itemStr.length > 0 && itemStr.length !== matchLen) {
              const charWidth = item.width / itemStr.length;
              subX = tx + matchIndex * charWidth;
              subWidth = matchLen * charWidth;
            }

            occurrences.push({
              ruleId: rule.id,
              pageIndex,
              x: subX,
              y: ty,
              width: subWidth,
              height: fontSize,
              fontSize,
              originalText: matchText,
              replaceText: '',
              maskColor: 'transparent',
              textColor: origTextColor,
              fontFamily: origFamily,
              isBold: origIsBold,
              isItemReflow: false,
            });

            pagesWithMatches.add(pageIndex);
          }
        }
      }

      if (hasReplacementMatch && firstReplacementRule) {
        const adjustedFontSize = Math.max(
          4,
          fontSize + (firstReplacementRule.fontSizeAdjustment || 0)
        );

        const finalTextColor =
          firstReplacementRule.textColor && firstReplacementRule.textColor !== 'auto'
            ? firstReplacementRule.textColor
            : origTextColor;

        const finalFontFamily =
          firstReplacementRule.fontFamily && firstReplacementRule.fontFamily !== 'auto'
            ? firstReplacementRule.fontFamily
            : origFamily;

        const finalIsBold =
          firstReplacementRule.isBold === 'auto' || firstReplacementRule.isBold === undefined
            ? origIsBold
            : Boolean(firstReplacementRule.isBold);

        const finalMaskColor =
          firstReplacementRule.maskColor && firstReplacementRule.maskColor !== 'auto'
            ? firstReplacementRule.maskColor
            : '#ffffff';

        occurrences.push({
          ruleId: firstReplacementRule.id,
          pageIndex,
          x: tx,
          y: ty,
          width: item.width,
          height: fontSize,
          fontSize: adjustedFontSize,
          originalText: matchedWord || itemStr,
          replaceText: firstReplacementRule.replaceText,
          maskColor: finalMaskColor,
          textColor: finalTextColor,
          fontFamily: finalFontFamily,
          isBold: finalIsBold,
          isItemReflow: true,
          itemKey: `p${pageIndex}-i${itemIdx}`,
          itemX: tx,
          itemY: ty,
          itemWidth: item.width,
          fullOriginalStr: itemStr,
          fullReplacedStr: currentItemStr,
        });

        pagesWithMatches.add(pageIndex);
      }
    }

    // B. OCR words search
    const ocrWords = ocrWordsByPage?.get(pageIndex);
    if (ocrWords && ocrWords.length > 0) {
      for (const rule of activeRules) {
        if (!rule.findText.trim() || rule.manualBox) continue;

        const rawTarget = rule.findText.trim();
        const target = rule.caseSensitive ? rawTarget : rawTarget.toLowerCase();

        for (const word of ocrWords) {
          const rawWordText = word.text;
          const cleanWordText = rawWordText.replace(/^[^\w]+|[^\w]+$/g, '');
          const wordText = rule.caseSensitive ? cleanWordText : cleanWordText.toLowerCase();

          const isMatch = rule.matchWholeWord
            ? wordText === target || rawWordText === rawTarget
            : wordText.includes(target) || rawWordText.includes(rawTarget);

          if (isMatch) {
            const baseFontSize = Math.max(word.pdfHeight * 0.75, 8);
            const adjustedFontSize = Math.max(4, baseFontSize + (rule.fontSizeAdjustment || 0));

            const finalTextColor =
              rule.textColor && rule.textColor !== 'auto'
                ? rule.textColor
                : (word as any).sampledTextColor || '#000000';

            const finalFontFamily =
              rule.fontFamily && rule.fontFamily !== 'auto'
                ? rule.fontFamily
                : 'Courier';

            occurrences.push({
              ruleId: rule.id,
              pageIndex,
              x: word.pdfX,
              y: word.pdfBaseline,
              width: word.pdfWidth,
              height: word.pdfHeight,
              fontSize: adjustedFontSize,
              originalText: word.text,
              replaceText: rule.replaceText,
              maskColor: rule.maskColor === 'auto' || !rule.maskColor ? (word.sampledColor || '#ffffff') : rule.maskColor,
              textColor: finalTextColor,
              fontFamily: finalFontFamily,
              isBold: rule.isBold === true,
              isItemReflow: false,
            });

            matchesByRule[rule.id] = (matchesByRule[rule.id] || 0) + 1;
            pagesWithMatches.add(pageIndex);
          }
        }
      }
    }
  }

  occurrences.forEach((o) => pagesWithMatches.add(o.pageIndex));

  return {
    totalMatches: occurrences.length,
    matchesByRule,
    pagesAffected: pagesWithMatches.size,
    occurrences,
    isScannedPdf: totalDigitalTextItems === 0,
  };
}

/**
 * Replaces matched text occurrences in the PDF with whole-item text reflow,
 * ensuring adjacent text shifts left/right seamlessly without gaps or overlaps.
 */
export async function replaceTextInPdf(
  pdfBytes: Uint8Array,
  rules: ReplacementRule[],
  ocrWordsByPage?: Map<number, OcrWord[]>
): Promise<{ modifiedBytes: Uint8Array; stats: ReplacementStats }> {
  const stats = await findMatchesInPdf(pdfBytes, rules, ocrWordsByPage);

  if (stats.totalMatches === 0) {
    return {
      modifiedBytes: pdfBytes,
      stats,
    };
  }

  const pdfDoc = await PDFDocument.load(pdfBytes);
  
  const fonts = {
    Helvetica: await pdfDoc.embedFont(StandardFonts.Helvetica),
    HelveticaBold: await pdfDoc.embedFont(StandardFonts.HelveticaBold),
    Courier: await pdfDoc.embedFont(StandardFonts.Courier),
    CourierBold: await pdfDoc.embedFont(StandardFonts.CourierBold),
    TimesRoman: await pdfDoc.embedFont(StandardFonts.TimesRoman),
    TimesRomanBold: await pdfDoc.embedFont(StandardFonts.TimesRomanBold),
  };

  const occurrencesByPage = new Map<number, MatchOccurrence[]>();
  for (const occ of stats.occurrences) {
    const list = occurrencesByPage.get(occ.pageIndex) || [];
    list.push(occ);
    occurrencesByPage.set(occ.pageIndex, list);
  }

  const pages = pdfDoc.getPages();

  for (const [pageIndex, occList] of occurrencesByPage.entries()) {
    if (pageIndex >= pages.length) continue;
    const page = pages[pageIndex];

    for (const occ of occList) {
      // Do NOT erase or mask anything if replaceText is empty
      if (!occ.replaceText || occ.replaceText.trim().length === 0) {
        continue;
      }

      if (occ.isItemReflow && occ.fullReplacedStr !== undefined && occ.itemX !== undefined && occ.itemY !== undefined) {
        // Whole-line reflow: Mask the entire original text item
        const maskY = occ.itemY - occ.fontSize * 0.22;
        const maskHeight = occ.fontSize * 1.35;
        const maskWidth = Math.max(occ.itemWidth! + 2, 4);
        const maskX = Math.max(0, occ.itemX - 1);

        page.drawRectangle({
          x: maskX,
          y: maskY,
          width: maskWidth,
          height: maskHeight,
          color: hexToRgb(occ.maskColor),
          opacity: 1,
        });

        // Pick font
        let font = fonts.Helvetica;
        if (occ.fontFamily === 'TimesRoman') {
          font = occ.isBold ? fonts.TimesRomanBold : fonts.TimesRoman;
        } else if (occ.fontFamily === 'Courier') {
          font = occ.isBold ? fonts.CourierBold : fonts.Courier;
        } else {
          font = occ.isBold ? fonts.HelveticaBold : fonts.Helvetica;
        }

        // Draw reflowed text seamlessly with no gaps
        page.drawText(occ.fullReplacedStr, {
          x: occ.itemX,
          y: occ.itemY,
          size: occ.fontSize,
          font,
          color: hexToRgb(occ.textColor),
        });
      } else {
        // Sub-word or manual box replacement
        const maskY = occ.y - occ.fontSize * 0.22;
        const maskHeight = occ.fontSize * 1.35;
        const maskWidth = Math.max(occ.width + 2, 4);
        const maskX = Math.max(0, occ.x - 0.75);

        page.drawRectangle({
          x: maskX,
          y: maskY,
          width: maskWidth,
          height: maskHeight,
          color: hexToRgb(occ.maskColor),
          opacity: 1,
        });

        if (occ.replaceText) {
          let font = fonts.Helvetica;
          if (occ.fontFamily === 'TimesRoman') {
            font = occ.isBold ? fonts.TimesRomanBold : fonts.TimesRoman;
          } else if (occ.fontFamily === 'Courier') {
            font = occ.isBold ? fonts.CourierBold : fonts.Courier;
          } else {
            font = occ.isBold ? fonts.HelveticaBold : fonts.Helvetica;
          }

          page.drawText(occ.replaceText, {
            x: occ.x,
            y: occ.y,
            size: occ.fontSize,
            font,
            color: hexToRgb(occ.textColor),
          });
        }
      }
    }
  }

  const modifiedBytes = await pdfDoc.save();
  return {
    modifiedBytes,
    stats,
  };
}
