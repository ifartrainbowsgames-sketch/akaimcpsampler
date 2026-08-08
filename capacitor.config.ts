import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.novaaudio.sampler',
  appName: 'Sampler',
  webDir: 'dist',

  android: {
    // Audio latency is the whole product, so give the WebView every
    // advantage: no debug overhead in release, hardware acceleration on.
    allowMixedContent: false,
    captureInput: true,
    webContentsDebuggingEnabled: false,
  },

  plugins: {
    // The web layer handles its own splash; a native one just delays the
    // first user gesture, which is what starts the AudioContext.
    SplashScreen: {
      launchShowDuration: 0,
    },
  },
};

export default config;
