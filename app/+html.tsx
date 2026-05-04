import { ScrollViewStyleReset } from 'expo-router/html';
import { type PropsWithChildren } from 'react';

/**
 * Root HTML template used by Expo Router's static export. Runs in Node only —
 * no DOM, no browser globals.
 *
 * The favicon links below lean on the OS `prefers-color-scheme` media query so
 * the browser picks the right artwork without any JS. The in-app theme picker
 * (Settings → Theme) honours its own choice at runtime by swapping the
 * `<link rel="icon">` href in `ThemedAppShell` (see `app/_layout.tsx`).
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

        {/* SVG favicons (served from `public/`) scale cleanly at every browser
            size. The light/dark split is OS-driven; the in-app picker
            overrides at runtime via `ThemedAppShell`. */}
        <link
          rel="icon"
          type="image/svg+xml"
          href="/favicon.svg"
          media="(prefers-color-scheme: light)"
        />
        <link
          rel="icon"
          type="image/svg+xml"
          href="/favicon-dark.svg"
          media="(prefers-color-scheme: dark)"
        />
        {/* PNG fallback for browsers that don't honour the SVG link. */}
        <link rel="alternate icon" type="image/png" href="/favicon.png" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />

        <ScrollViewStyleReset />
      </head>
      <body>{children}</body>
    </html>
  );
}
