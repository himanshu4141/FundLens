const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

/**
 * Force CJS resolution for packages whose ESM builds use `import.meta`
 * (a browser/Node-module-only API that Metro's web bundler doesn't support).
 *
 * Specifically, zustand's `esm/middleware.mjs` uses `import.meta.env.MODE`
 * for its Redux DevTools integration. Metro resolves to the ESM path when the
 * module is reachable from a file whose extension triggers ESM semantics.
 * Redirecting to the CJS `.js` variants avoids the SyntaxError at runtime.
 */
const originalResolveRequest = config.resolver.resolveRequest;

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === 'web' && /^zustand(\/.*)?$/.test(moduleName)) {
    // zustand      → zustand/index.js
    // zustand/foo  → zustand/foo.js
    const subpath = moduleName === 'zustand' ? 'index' : moduleName.replace('zustand/', '');
    const cjsPath = path.resolve(__dirname, 'node_modules/zustand', `${subpath}.js`);
    return { filePath: cjsPath, type: 'sourceFile' };
  }

  if (originalResolveRequest) {
    return originalResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
