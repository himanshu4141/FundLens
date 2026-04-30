const VARIANTS = {
  production: {
    appName: 'FundLens',
    scheme: 'fundlens',
    iosBundleIdentifier: 'com.fundlens.app',
    androidPackage: 'com.fundlens.app',
  },
  development: {
    appName: 'FundLens Dev',
    scheme: 'fundlens-dev',
    iosBundleIdentifier: 'com.fundlens.app.dev',
    androidPackage: 'com.fundlens.app.dev',
  },
  'preview-main': {
    appName: 'FundLens Main',
    scheme: 'fundlens-main',
    iosBundleIdentifier: 'com.fundlens.app.mainpreview',
    androidPackage: 'com.fundlens.app.mainpreview',
  },
  'preview-pr': {
    appName: 'FundLens PR',
    scheme: 'fundlens-pr',
    iosBundleIdentifier: 'com.fundlens.app.prpreview',
    androidPackage: 'com.fundlens.app.prpreview',
  },
};

function getVariant() {
  const raw = process.env.APP_VARIANT ?? 'production';
  return Object.prototype.hasOwnProperty.call(VARIANTS, raw) ? raw : 'production';
}

module.exports = ({ config }) => {
  const variant = getVariant();
  const variantConfig = VARIANTS[variant];

  return {
    ...config,
    name: variantConfig.appName,
    slug: 'fundlens',
    version: '1.0.0',
    scheme: variantConfig.scheme,
    orientation: 'portrait',
    icon: './assets/images/icon.png',
    userInterfaceStyle: 'automatic',
    newArchEnabled: true,
    runtimeVersion: {
      policy: 'appVersion',
    },
    updates: {
      url: 'https://u.expo.dev/cca64872-6fe3-4c13-86ae-caedecdff628',
    },
    ios: {
      supportsTablet: false,
      bundleIdentifier: variantConfig.iosBundleIdentifier,
    },
    android: {
      adaptiveIcon: {
        foregroundImage: './assets/images/adaptive-icon.png',
        backgroundColor: '#ffffff',
      },
      package: variantConfig.androidPackage,
      softwareKeyboardLayoutMode: 'resize',
    },
    web: {
      bundler: 'metro',
      output: 'static',
      favicon: './assets/images/favicon.png',
    },
    plugins: [
      'expo-router',
      [
        'expo-splash-screen',
        {
          image: './assets/images/splash-icon.png',
          imageWidth: 200,
          resizeMode: 'contain',
          backgroundColor: '#ffffff',
        },
      ],
    ],
    experiments: {
      typedRoutes: true,
    },
    extra: {
      appVariant: variant,
      appScheme: variantConfig.scheme,
      eas: {
        projectId: 'cca64872-6fe3-4c13-86ae-caedecdff628',
      },
    },
    owner: 'himanshu4141',
  };
};
