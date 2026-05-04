import { ReactNode } from 'react';
import { useResponsiveLayout } from './useResponsiveLayout';
import { DesktopShell } from './DesktopShell';

/**
 * Wraps an out-of-tabs route (Fund Detail, Money Trail, Portfolio Insights,
 * Tools, etc.) with the desktop sidebar shell when the viewport is desktop.
 * On mobile it renders children directly so phones / Android / iOS see no
 * change. Use `framed={false}` so each screen continues to manage its own
 * scroll region and content frame inside the shell.
 */
export function ResponsiveRouteFrame({ children }: { children: ReactNode }) {
  const { layout } = useResponsiveLayout();
  if (layout === 'desktop') {
    return <DesktopShell framed={false}>{children}</DesktopShell>;
  }
  return <>{children}</>;
}
