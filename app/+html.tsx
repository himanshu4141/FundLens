import { ScrollViewStyleReset } from 'expo-router/html';
import { type PropsWithChildren } from 'react';

/**
 * Root HTML template used by Expo Router's static export. Runs in Node only —
 * no DOM, no browser globals.
 *
 * Single SVG favicon, matching foliolens.in. Browser tab strips are light
 * even when the OS is in dark mode, so a white-on-transparent dark variant
 * disappeared on the tab; the navy-arc light variant reads correctly on
 * both light and dark browser chrome.
 */
export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />
        <meta name="theme-color" content="#0A1430" media="(prefers-color-scheme: dark)" />
        <meta name="theme-color" content="#FAFBFD" media="(prefers-color-scheme: light)" />

        <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
        {/* PNG fallback for browsers that don't honour the SVG link. */}
        <link rel="alternate icon" type="image/png" href="/favicon.png" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />

        <ScrollViewStyleReset />
      </head>
      <body>{children}</body>
    </html>
  );
}
