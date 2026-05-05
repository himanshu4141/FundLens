import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/react';

/**
 * Mounts Vercel Web Analytics + Speed Insights on the web build only.
 *
 * Gated by EXPO_PUBLIC_ENABLE_INSIGHTS, which is set on the Vercel project
 * for the production environment and the `main` preview branch (via a
 * branch-scoped env var). PR-preview deploys leave it unset, so this
 * component renders nothing there and no scripts are loaded.
 *
 * Visitor segmentation by Device (desktop / mobile / tablet), OS
 * (iOS / Android / Windows / macOS), Browser, and Country is automatic
 * in the Vercel dashboard once these mount — no extra code needed.
 */
export default function VercelInsights() {
  if (process.env.EXPO_PUBLIC_ENABLE_INSIGHTS !== '1') return null;
  return (
    <>
      <Analytics />
      <SpeedInsights />
    </>
  );
}
