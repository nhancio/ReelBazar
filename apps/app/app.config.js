// Dynamic config (deliberately not app.json) so `android.googleServicesFile` can point at
// an EAS-injected secret file in cloud builds while falling back to the local, gitignored
// copy for local/dev builds. Carried over from the Aura+ setup, which shipped on this exact
// pattern — see docs/EXPO_MIGRATION.md.
const appEnvironment = process.env.EXPO_PUBLIC_APP_ENV ?? 'development';
const updateChannel =
  appEnvironment === 'production'
    ? 'production'
    : appEnvironment === 'preview'
      ? 'preview'
      : 'development';

// EAS project @nithindidigam/rava, created 21 Aug 2026. Not a secret — it identifies the
// project for OTA updates and builds, so it is committed rather than kept in .env. The env
// var stays as an override for anyone pointing this app at a different EAS project.
const EAS_PROJECT_ID =
  process.env.EXPO_PUBLIC_EAS_PROJECT_ID ?? '90f1a13d-4e29-407b-a025-31075553022d';

const googleServicesFile =
  process.env.GOOGLE_SERVICES_JSON ??
  (require('fs').existsSync(`${__dirname}/google-services.json`) ? './google-services.json' : null);

const iosGoogleServicesFile =
  process.env.GOOGLE_SERVICES_INFO_PLIST ??
  (require('fs').existsSync(`${__dirname}/GoogleService-Info.plist`) ? './GoogleService-Info.plist' : null);

module.exports = {
  expo: {
    name: 'Rava',
    slug: 'rava',
    version: '1.0.0',
    orientation: 'portrait',
    icon: './assets/images/icon.png',
    scheme: 'rava',
    userInterfaceStyle: 'automatic',
    backgroundColor: '#000000',

    // OTA updates (EAS Update). The 'appVersion' runtimeVersion policy means `eas update`
    // pushes new JS to installed builds of the same `version` WITHOUT a rebuild, while
    // bumping `version` (i.e. shipping native changes) correctly forces a fresh build.
    runtimeVersion: { policy: 'appVersion' },
    ...(EAS_PROJECT_ID
      ? {
          updates: {
            url: `https://u.expo.dev/${EAS_PROJECT_ID}`,
            // EAS Build injects the same header from its `channel` field. Keeping it here
            // also gives direct local native builds the correct OTA channel.
            requestHeaders: { 'expo-channel-name': updateChannel },
          },
        }
      : {}),

    ios: {
      supportsTablet: false,
      usesAppleSignIn: true,
      bundleIdentifier: 'com.nhancio.rava',
      appleTeamId: '76G23XAVL3',
      // Store build number. Bump before creating the next iOS artifact.
      buildNumber: '1',
      // EAS Build injects the "GOOGLE_SERVICES_INFO_PLIST" file-type secret and points this env
      // var at it; locally it falls back to the gitignored copy in this directory. Omitted
      // entirely when neither exists.
      ...(iosGoogleServicesFile ? { googleServicesFile: iosGoogleServicesFile } : {}),
      infoPlist: {
        NSCameraUsageDescription:
          'Rava uses your camera to record fashion reels when you choose to create one.',
        NSMicrophoneUsageDescription:
          'Rava records audio with your reels so your videos have sound.',
        NSPhotoLibraryUsageDescription:
          'Rava lets you choose a video from your library when you upload a reel, and a photo when you set your profile picture.',
        ITSAppUsesNonExemptEncryption: false,
      },
    },

    android: {
      softwareKeyboardLayoutMode: 'resize',
      package: 'com.nhancio.rava',
      versionCode: 1,
      // EAS Build injects the "GOOGLE_SERVICES_JSON" file-type secret and points this env
      // var at it; locally it falls back to the gitignored copy in this directory. Omitted
      // entirely when neither exists, otherwise every `expo` command warns about a config it
      // cannot parse — the file only lands once Firebase has an Android app registered.
      ...(googleServicesFile ? { googleServicesFile } : {}),
      permissions: [
        'android.permission.CAMERA',
        'android.permission.RECORD_AUDIO',
        'android.permission.VIBRATE',
        'android.permission.POST_NOTIFICATIONS',
      ],
      // Expo libraries merge permissions into the manifest even when no shipped feature uses
      // them. Strip the ones Rava never needs rather than requesting sensitive access with
      // no customer benefit — Play flags unexplained permissions during review.
      blockedPermissions: [
        'android.permission.READ_CALENDAR',
        'android.permission.WRITE_CALENDAR',
        'android.permission.ACTIVITY_RECOGNITION',
      ],
      adaptiveIcon: {
        backgroundColor: '#000000',
        foregroundImage: './assets/images/android-icon-foreground.png',
        monochromeImage: './assets/images/android-icon-monochrome.png',
      },
      predictiveBackGestureEnabled: false,
    },

    web: {
      bundler: 'metro',
      // 'single' emits a client-side-routed SPA into dist/, which is what the existing
      // Firebase Hosting rewrite for site `reelbaazar` already expects.
      output: 'single',
      favicon: './assets/images/favicon.png',
    },

    plugins: [
      'expo-router',
      [
        // R8 is OFF by default in the Expo Android template, which ships unshrunk DEX in
        // every release AAB. Rava pulls in camera + video + Google Play Services, so the
        // unshrunk graph is large. Minification tree-shakes the unreachable classes and
        // resource shrinking drops unreferenced resources.
        //
        // No extra keep rules are set deliberately: react-native, expo, expo-modules-core,
        // expo-updates, expo-image, expo-video, reanimated and svg all ship their own
        // consumer ProGuard rules, and the Play Services AARs carry theirs. Blanket `-keep`
        // globs here would silently undo most of the saving. R8 problems surface at RUNTIME,
        // not build time — smoke-test a release build (Google Sign-In, camera capture, reel
        // playback, upload) before promoting, and read stack traces via the build's
        // mapping.txt.
        'expo-build-properties',
        {
          android: {
            enableMinifyInReleaseBuilds: true,
            enableShrinkResourcesInReleaseBuilds: true,
          },
          ios: {
            // `pod install` fails outright without these:
            //   [!] The Swift pod `AppCheckCore` depends upon `GoogleUtilities` and
            //       `RecaptchaInterop`, which do not define modules.
            // AppCheckCore arrives via @react-native-google-signin/google-signin and is
            // written in Swift, which can only import a static-library pod that publishes a
            // module map — neither of these Objective-C pods generates one by default.
            // Per-pod opt-in is used so the rest of the pod graph keeps its integration;
            // useFrameworks: 'static' would change linkage for every pod.
            extraPods: [
              { name: 'GoogleUtilities', modular_headers: true },
              { name: 'RecaptchaInterop', modular_headers: true },
            ],
          },
        },
      ],
      [
        'expo-camera',
        {
          cameraPermission:
            'Rava uses your camera to record fashion reels when you choose to create one.',
          microphonePermission:
            'Rava records audio with your reels so your videos have sound.',
          // Rava records video, so audio IS required here — unlike a photo-only app.
          recordAudioAndroid: true,
          // Rava never scans a barcode or QR code. Leaving this on ships ML Kit's
          // libbarhopper_v3.so (~4.7 MB) plus its model files (~0.9 MB) to every Android
          // install for nothing.
          barcodeScannerEnabled: false,
        },
      ],
      [
        'expo-image-picker',
        {
          photosPermission:
            'Rava lets you choose a video from your library when you upload a reel, and a photo when you set your profile picture.',
        },
      ],
      [
        'expo-splash-screen',
        {
          image: './assets/images/splash-icon.png',
          resizeMode: 'contain',
          backgroundColor: '#000000',
        },
      ],
      [
        'expo-video',
        {
          // The feed plays inline only. Neither is needed and both add native surface area.
          supportsBackgroundPlayback: false,
          supportsPictureInPicture: false,
        },
      ],
      'expo-web-browser',
    ],

    experiments: {
      typedRoutes: true,
    },

    extra: {
      router: {},
      ...(EAS_PROJECT_ID ? { eas: { projectId: EAS_PROJECT_ID } } : {}),
    },
  },
};
