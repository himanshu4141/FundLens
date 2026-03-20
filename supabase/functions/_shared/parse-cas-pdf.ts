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
 *   1. Use npm:pdf-parse (pdfjs-based) to extract raw text from the
 *      AES/RC4-encrypted PDF (PAN is the password).
 *   2. Walk the extracted text line-by-line using regex patterns that
 *      match the well-known CAMS / KFintech CAS text layout.
 *   3. Return a CASParseResult matching the shape that _shared/import-cas.ts
 *      already expects — so no downstream changes are needed.
 *
 * Limitations:
 *   - Regex-based; unusual AMC names or format edge cases may miss data.
 *     The function logs warnings rather than throwing so a partial parse
 *     still imports whatever was successfully extracted.
 *   - ISIN is extracted when present; AMFI code is the critical field.
 */

// deno-lint-ignore-file no-explicit-any

import type { CASParseResult, CASFolio, CASScheme, CASTransaction } from './import-cas.ts';

// ---------------------------------------------------------------------------
// PDF text extraction
// ---------------------------------------------------------------------------

async function extractPdfText(pdfBytes: Uint8Array, password: string): Promise<string> {
  // Use the direct lib path to skip the test-runner shim that errors in Deno.
  const pdfParse = (await import('npm:pdf-parse/lib/pdf-parse.js')).default as (
    buffer: Uint8Array,
    options?: Record<string, unknown>,
  ) => Promise<{ text: string; numpages: number }>;

  const data = await pdfParse(pdfBytes, { password });
  console.log('[parse-cas-pdf] extracted %d pages of text', data.numpages);
  return data.text;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Trim and collapse internal whitespace to a single space. */
function norm(s: string): string {
  return s.replace(/\s+/g, ' ').trim();
}

/**
 * Infer broad scheme type from the scheme name.
 * CASParser.in returns "Equity" | "Debt" | "Hybrid" | "Other".
 */
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

/** Parse a number string that may use commas (e.g. "1,23,456.78"). */
function parseNum(s: string): number {
  if (!s || s.trim() === '-' || s.trim() === '') return 0;
  return parseFloat(s.replace(/,/g, '')) || 0;
}

/**
 * Detect transaction type from the description text as it appears in CAS.
 * Returns uppercase strings that normaliseTxType() in import-cas.ts understands.
 */
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
  if (d.includes('bonus')) return 'PURCHASE'; // treat bonus units as purchase
  return 'PURCHASE'; // safe default
}

// ---------------------------------------------------------------------------
// Main parser
// ---------------------------------------------------------------------------

/**
 * Parse a CAS PDF and return the structured result ready for importCASData().
 *
 * @param pdfBytes  Raw bytes of the CAS PDF file
 * @param password  PDF password (typically the investor's PAN in UPPER CASE)
 */
export async function parseCasPdf(
  pdfBytes: Uint8Array,
  password: string,
): Promise<CASParseResult> {
  const rawText = await extractPdfText(pdfBytes, password);
  return parseCasText(rawText);
}

/**
 * Exported for unit-testing without a real PDF.
 */
export function parseCasText(rawText: string): CASParseResult {
  const lines = rawText.split('\n').map((l) => norm(l)).filter(Boolean);

  const folios: CASFolio[] = [];

  // ── State machine ──────────────────────────────────────────────────────────
  //
  // We walk through lines and toggle between states:
  //   'header'      — before any folio
  //   'folio'       — inside a folio block (collecting scheme blocks)
  //   'scheme'      — inside a scheme block (collecting transactions)
  //   'transactions'— inside the transaction table for a scheme

  type State = 'header' | 'folio' | 'scheme' | 'transactions';
  let state: State = 'header';

  let currentFolio: CASFolio | null = null;
  let currentScheme: CASScheme | null = null;
  let pendingAmcLine: string | null = null; // line that may be an AMC name

  // Regex patterns
  // CAMS: "Folio No: 1234567/89" | KFintech: "Folio No : 12345678"
  const reFollio = /Folio\s*(?:No\.?|Number)?\s*[:\-]?\s*([\w\/]+)/i;
  // Scheme ISIN line: "ISIN: INF209K01VN9" (sometimes on same line as scheme name)
  const reIsin = /ISIN\s*[:\-]\s*([A-Z]{2}[A-Z0-9]{10})/i;
  // AMFI code: "AMFI: 119551" or "AMFI CODE: 119551" or "AMFI No: 119551"
  const reAmfi = /AMFI(?:\s+(?:Code|No\.?))?\s*[:\-]\s*(\d+)/i;
  // Transaction row: starts with a date like "01-Jan-2020"
  const reDate = /^(\d{2}-[A-Za-z]{3}-\d{4})\s+(.*)/;
  // Numbers at end of transaction line (amount, units, nav, balance)
  // CAMS layout: date | description | amount (Dr/Cr) | units | nav | balance
  const reTransactionNums = /([\d,]+\.?\d*)\s+([\d,]+\.?\d*)\s+([\d,]+\.?\d*)\s+([\d,]+\.?\d*)(?:\s+[\d,]+\.?\d*)?$/;

  // "Opening Balance" line signals start of transaction table for a scheme
  const reOpeningBal = /Opening\s+Balance\s*[:\-]?\s*([\d,]+\.?\d*)/i;
  // "Closing Balance" line signals end of transaction table
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

    // ── Folio detection (works in any state) ────────────────────────────────
    const mFolio = reFollio.exec(line);
    if (mFolio) {
      // Whatever came before might be AMC name
      saveFolio();
      const folioNumber = mFolio[1].trim();
      // AMC: pendingAmcLine if it looks like an AMC name (not a section header)
      const amc = pendingAmcLine && !/statement|consolidated|account/i.test(pendingAmcLine)
        ? pendingAmcLine
        : '';
      currentFolio = { folio_number: folioNumber, amc, schemes: [] };
      state = 'folio';
      pendingAmcLine = null;
      continue;
    }

    // ── Track last non-trivial line as potential AMC ─────────────────────────
    if (state === 'header' || state === 'folio') {
      if (line.length > 4 && !/^\d/.test(line) && !reDate.test(line)) {
        pendingAmcLine = line;
      }
    }

    // ── Inside a folio: look for scheme blocks ───────────────────────────────
    if (state === 'folio' || state === 'scheme' || state === 'transactions') {

      // ISIN line — signals a new scheme starting
      const mIsin = reIsin.exec(line);
      if (mIsin) {
        saveScheme();
        // Scheme name is usually on the line just before the ISIN line
        // (but sometimes on same line — look backwards)
        let schemeName = '';
        if (i > 0) {
          // Try the previous non-empty line if it doesn't look like a folio/header
          const prev = lines[i - 1];
          if (prev && !/Folio|ISIN|AMFI|Opening|Closing/i.test(prev) && prev.length > 5) {
            schemeName = prev;
          }
        }
        // Also check if scheme name is on the same line before ISIN:
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

      // AMFI code line
      const mAmfi = reAmfi.exec(line);
      if (mAmfi && currentScheme) {
        currentScheme.additional_info = {
          ...currentScheme.additional_info,
          amfi: mAmfi[1],
        };
        continue;
      }

      // Scheme name fallback: if we see "Registrar: " or "RTA Code: " that usually
      // follows the scheme name on the line before ISIN
      if (/^Registrar|^RTA\s+Code/i.test(line) && currentScheme && !currentScheme.name) {
        if (i > 0) currentScheme.name = lines[i - 1];
      }

      // Opening balance → start collecting transactions
      if (reOpeningBal.test(line) && currentScheme) {
        state = 'transactions';
        continue;
      }

      // Closing balance → end of transaction table
      if (reClosingBal.test(line) && state === 'transactions') {
        state = 'folio';
        continue;
      }

      // Transaction row
      if (state === 'transactions' && currentScheme) {
        const mTxDate = reDate.exec(line);
        if (mTxDate) {
          const dateStr = mTxDate[1]; // "01-Jan-2020"
          const rest = mTxDate[2];

          // Extract trailing numbers (amount, units, nav, balance)
          const mNums = reTransactionNums.exec(rest);
          let amount = 0, units = 0, nav = 0, balance = 0;
          if (mNums) {
            // Order depends on Dr/Cr notation; CAMS layout: amount | units | nav | balance
            amount = parseNum(mNums[1]);
            units = parseNum(mNums[2]);
            nav = parseNum(mNums[3]);
            balance = parseNum(mNums[4]);
          }

          // Description is everything before the trailing numbers
          const description = mNums ? rest.slice(0, rest.lastIndexOf(mNums[0])).trim() : rest.trim();
          const txType = detectTxType(description);

          // Redemptions: units should be negative conceptually but import-cas.ts
          // uses Math.abs so just pass the positive value.
          const tx: CASTransaction = {
            date: dateStr,
            type: txType,
            description,
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

  // Flush final folio
  saveFolio();

  console.log('[parse-cas-pdf] parsed %d folios', folios.length);
  return { mutual_funds: folios };
}
