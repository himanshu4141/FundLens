/**
 * Native fallback for the Vercel insights mount. Real implementation lives
 * in the `.web.tsx` sibling — Metro will pick that up only on the web bundle,
 * keeping the native bundles free of browser-only code.
 */
export default function VercelInsights() {
  return null;
}
