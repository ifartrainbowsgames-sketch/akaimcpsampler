# Android build

The app runs in a Capacitor WebView — same codebase as the web version, packaged
as a real APK with its own icon, Play Store listing and offline install.

## Get an APK without a computer

Pushing to `main` triggers `.github/workflows/android.yml`, which builds the
APK on GitHub's runners and attaches it to a rolling release tagged `latest`.

On your phone: open the repo → **Releases** → **Latest build** → tap the `.apk`
→ allow installs from that source when prompted. No SDK, no laptop.

You can also trigger a build by hand from the **Actions** tab without pushing
anything, which works from the GitHub mobile app.

## Build an APK locally

Requires **Android Studio** (or just the Android SDK + JDK 17) on a computer.

```bash
npm install
npm run android:apk
```

The debug APK lands at:

```
android/app/build/outputs/apk/debug/app-debug.apk
```

Copy it to your phone and install it (you'll need "install unknown apps"
enabled for whatever app you transfer it with).

To open the project in Android Studio instead — useful for running on a
connected device with logs:

```bash
npm run android
```

## Signed release build

```bash
keytool -genkey -v -keystore sampler.keystore \
  -alias sampler -keyalg RSA -keysize 2048 -validity 10000
```

Add to `android/key.properties` (gitignored):

```properties
storeFile=../sampler.keystore
storePassword=…
keyAlias=sampler
keyPassword=…
```

Then `npm run android:release`. Output goes to
`android/app/build/outputs/apk/release/`.

For the Play Store, build an AAB instead: `./gradlew bundleRelease`.

## What's configured

| Setting | Why |
|---|---|
| `RECORD_AUDIO`, `MODIFY_AUDIO_SETTINGS` | Sample recording from the mic |
| `READ_MEDIA_AUDIO` | Importing audio files from the device |
| `audio.low_latency`, `audio.pro` features | Declared optional — lets the Play Store surface the app to users whose hardware can deliver tight timing |
| `hardwareAccelerated`, `largeHeap` | Decoded samples are held in memory; the default heap is tight |
| `screenOrientation="portrait"` | The panel layout is portrait, matching the hardware's proportions |
| `FLAG_KEEP_SCREEN_ON` | The screen going dark mid-performance is not acceptable on an instrument |
| `WebChromeClient.onPermissionRequest` | `getUserMedia` in a WebView needs host approval on top of the Android runtime permission — without it, recording silently fails |

## The honest caveat: latency

**Measure pad-to-sound latency on your actual device before building anything
else.** This is the one thing that decides whether the app is usable.

Web Audio inside a WebView goes through the same path as Chrome on Android,
which means it does *not* get the low-latency AAudio path that native audio
apps use. Expect somewhere between 20 ms on a recent flagship and 80 ms+ on
budget or older hardware. Under ~30 ms feels fine. Over ~50 ms and it will feel
broken no matter how good everything else is, and that is a hardware and
platform limit, not something a Capacitor setting fixes.

If it lands badly on your target devices, the fix is not configuration — it is
replacing the audio engine with native Kotlin using **Oboe** (Google's
low-latency audio library, which picks AAudio or OpenSL ES per device) and
keeping this React app as the UI layer, talking to it over a Capacitor plugin.
That is a significant piece of work, so it is worth knowing whether you need it
before committing to anything else.

Test on the worst phone you expect people to use, not the best one you own.
