/**
 * parse-cas-pdf — local CAS PDF parser for Deno Edge Functions.
 *
 * Replaces the casparser.in /v4/smart/parse API call so the PDF upload
 * path works without any paid external dependency.
 *
 * Supports:
 *   - CAMS CAS (the most common format)
 *   - KFintech/KFin CAS
 *   - MFCentral CAS (basic support)
 *
 * Strategy:
 *   1. Use unpdf's serverless PDF.js build to extract raw text from the
 *      encrypted PDF (PAN is the password).
 *   2. Walk the extracted text line-by-line using regex patterns that
 *      match the well-known CAMS / KFintech CAS text layout.
 *   3. Return a CASParseResult matching the shape that _shared/import-cas.ts
 *      already expects — so no downstream changes are needed.
 */

// deno-lint-ignore-file no-explicit-any

import { extractText, getDocumentProxy } from 'npm:unpdf@1.4.0';
import type { CASParseResult, CASFolio, CASScheme, CASTransaction } from './import-cas.ts';

async function extractPdfText(pdfBytes: Uint8Array, password: string): Promise<string> {
  const pdf = await getDocumentProxy(pdfBytes, { password });

  try {
    const data = await extractText(pdf, { mergePages: true });
    console.log('[parse-cas-pdf] extracted %d pages of text', data.totalPages);
    return data.text;
  } catch (error) {
    if (error instanceof Error) {
      const msg = error.message.toLowerCase();
      if (msg.includes('password') || msg.includes('decrypt') || msg.includes('encrypted')) {
        throw new Error(`PDF password error: ${error.message}`);
      }
    }
    throw error;
  } finally {
    await pdf.destroy();
  }
}

function norm(s: string): string {
  return s.replace(/\s+/g, ' ').trim();
}

function inferSchemeType(name: string): string {
  const n = name.toLowerCase();
  if (n.includes('liquid') || n.includes('overnight') || n.includes('money market') ||
      n.includes('ultra short') || n.includes('short duration') || n.includes('medium duration') ||
      n.includes('long duration') || n.includes('gilt') || n.includes('banking and psu') ||
      n.includes('corporate bond') || n.includes('credit risk') || n.includes('floater') ||
      n.includes('dynamic bond') || n.includes('debt') || n.includes('bond fund') ||
      n.includes('fixed maturity') || n.includes('fmp')) return 'Debt';
  if (n.includes('equity') || n.includes('elss') || n.includes('tax saver') ||
      n.includes('small cap') || n.includes('mid cap') || n.includes('large cap') ||
      n.includes('multi cap') || n.includes('flexi cap') || n.includes('thematic') ||
      n.includes('sectoral') || n.includes('focused') || n.includes('value fund') ||
      n.includes('contra fund') || n.includes('dividend yield')) return 'Equity';
  if (n.includes('hybrid') || n.includes('balanced') || n.includes('aggressive') ||
      n.includes('conservative') || n.includes('arbitrage') || n.includes('equity savings') ||
      n.includes('multi asset')) return 'Hybrid';
  return 'Other';
}

function parseNum(s: string): number {
  if (!s || s.trim() === '-' || s.trim() === '') return 0;
  return parseFloat(s.replace(/,/g, '')) || 0;
}

function detectTxType(desc: string): string {
  const d = desc.toLowerCase();
  if (d.includes('switch in') || d.includes('switch-in')) return 'SWITCH_IN';
  if (d.includes('switch out') || d.includes('switch-out')) return 'SWITCH_OUT';
  if (d.includes('redempt') || d.includes('withdrawal') || d.includes('repurchase')) return 'REDEMPTION';
  if (d.includes('sip') || d.includes('systematic investment')) return 'PURCHASE_SIP';
  if (d.includes('purchase') || d.includes('buy') || d.includes('subscription') ||
      d.includes('lumpsum') || d.includes('nfo allotment') || d.includes('allotment')) return 'PURCHASE';
  if (d.includes('dividend reinvest')) return 'DIVIDEND_REINVEST';
  if (d.includes('dividend payout') || d.includes('income distribution')) return 'DIVIDEND_PAYOUT';
  if (d.includes('segregat')) return 'SEGREGATION';
  if (d.includes('stamp duty')) return 'STAMP_DUTY_TAX';
  if (d.includes('tds')) return 'TDS_TAX';
  if (d.includes('bonus')) return 'PURCHASE';
  return 'PURCHASE';
}

export async function parseCasPdf(
  pdfBytes: Uint8Array,
  password: string,
): Promise<CASParseResult> {
  const rawText = await extractPdfText(pdfBytes, password);
  return parseCasText(rawText);
}

export function parseCasText(rawText: string): CASParseResult {
  const lines = rawText.split('\n').map((l) => norm(l)).filter(Boolean);
  const folios: CASFolio[] = [];

  type State = 'header' | 'folio' | 'scheme' | 'transactions';
  let state: State = 'header';

  let currentFolio: CASFolio | null = null;
  let currentScheme: CASScheme | null = null;
  let pendingAmcLine: string | null = null;

  const reFolio = /Folio\s*(?:No\.?|Number)?\s*[:\-]?\s*([\w\/]+)/i;
  const reIsin = /ISIN\s*[:\-]\s*([A-Z]{2}[A-Z0-9]{10})/i;
  const reAmfi = /AMFI(?:\s+(?:Code|No\.?))?\s*[:\-]\s*(\d+)/i;
  const reDate = /^(\d{2}-[A-Za-z]{3}-\d{4})\s+(.*)/;
  const reTransactionNums = /([\d,]+\.?\d*)\s+([\d,]+\.?\d*)\s+([\d,]+\.?\d*)\s+([\d,]+\.?\d*)(?:\s+[\d,]+\.?\d*)?$/;
  const reOpeningBal = /Opening\s+Balance\s*[:\-]?\s*([\d,]+\.?\d*)/i;
  const reClosingBal = /Closing\s+Balance\s*[:\-]?\s*([\d,]+\.?\d*)/i;

  function saveScheme() {
    if (currentScheme && currentFolio) {
      if (!currentScheme.additional_info?.amfi) {
        console.warn('[parse-cas-pdf] scheme "%s" has no AMFI code — skipping', currentScheme.name ?? '(unknown)');
      } else {
        currentFolio.schemes = currentFolio.schemes ?? [];
        currentFolio.schemes.push(currentScheme);
      }
    }
    currentScheme = null;
  }

  function saveFolio() {
    saveScheme();
    if (currentFolio) {
      if ((currentFolio.schemes ?? []).length > 0) {
        folios.push(currentFolio);
      } else {
        console.warn('[parse-cas-pdf] folio %s had no parseable schemes — skipping', currentFolio.folio_number);
      }
    }
    currentFolio = null;
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    const mFolio = reFolio.exec(line);
    if (mFolio) {
      saveFolio();
      const folioNumber = mFolio[1].trim();
      const amc = pendingAmcLine && !/statement|consolidated|account/i.test(pendingAmcLine)
        ? pendingAmcLine
        : '';
      currentFolio = { folio_number: folioNumber, amc, schemes: [] };
      state = 'folio';
      pendingAmcLine = null;
      continue;
    }

    if (state === 'header' || state === 'folio') {
      if (line.length > 4 && !/^\d/.test(line) && !reDate.test(line)) {
        pendingAmcLine = line;
      }
    }

    if (state === 'folio' || state === 'scheme' || state === 'transactions') {
      const mIsin = reIsin.exec(line);
      if (mIsin) {
        saveScheme();
        let schemeName = '';
        if (i > 0) {
          const prev = lines[i - 1];
          if (prev && !/Folio|ISIN|AMFI|Opening|Closing/i.test(prev) && prev.length > 5) {
            schemeName = prev;
          }
        }
        const sameLineName = line.replace(reIsin, '').replace(/ISIN\s*[:\-]/i, '').trim();
        if (sameLineName.length > 5) schemeName = sameLineName;

        currentScheme = {
          name: schemeName,
          isin: mIsin[1],
          type: inferSchemeType(schemeName),
          additional_info: {},
          transactions: [],
        };
        state = 'scheme';
        continue;
      }

      const mAmfi = reAmfi.exec(line);
      if (mAmfi && currentScheme) {
        currentScheme.additional_info = {
          ...currentScheme.additional_info,
          amfi: mAmfi[1],
        };
        continue;
      }

      if (/^Registrar|^RTA\s+Code/i.test(line) && currentScheme && !currentScheme.name) {
        if (i > 0) currentScheme.name = lines[i - 1];
      }

      const mOpening = reOpeningBal.exec(line);
      if (mOpening && currentScheme) {
        state = 'transactions';
        continue;
      }

      if (state === 'transactions' && currentScheme) {
        if (reClosingBal.test(line)) {
          state = 'scheme';
          continue;
        }

        const mDate = reDate.exec(line);
        if (mDate) {
          const date = mDate[1];
          const rest = mDate[2];
          const nums = reTransactionNums.exec(rest);
          if (nums) {
            const amount = parseNum(nums[1]);
            const units = parseNum(nums[2]);
            const nav = parseNum(nums[3]);
            const balance = parseNum(nums[4]);

            let description = rest.slice(0, nums.index).trim();
            description = description.replace(/\s+(Cr|Dr)$/i, '').trim();

            const tx: CASTransaction = {
              date,
              description,
              type: detectTxType(description),
              amount,
              units,
              nav,
              balance,
            };
            currentScheme.transactions = currentScheme.transactions ?? [];
            currentScheme.transactions.push(tx);
            continue;
          }
        }
      }
    }
  }

  saveFolio();

  console.log('[parse-cas-pdf] parsed %d folios', folios.length);

  return { investor_info: {}, mutual_funds: folios };
}
