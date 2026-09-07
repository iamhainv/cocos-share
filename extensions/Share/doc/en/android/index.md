# Cocos Share — Android (English)

## What the extension does for you

When **Enable Share** is on for the Android tab, the build hook:

1. Copies `template/android/libshare` into the built project as a new
   Gradle module `proj/libshare` (Java sources, `AndroidManifest.xml`,
   `build.gradle`, and the `share_file_provider_paths.xml` resource).
2. Injects `include ':libshare'` into the built project's `settings.gradle`
   and `implementation project(':libshare')` into
   `native/engine/android/app/build.gradle`, both idempotently (the hook
   checks for the line before appending, so re-running the build never
   duplicates it).
3. Registers the module's `ShareInitProvider`, which runs before
   `Application.onCreate()` and wires up the native `"share"` bridge channel
   — you do not need to touch `MainActivity`/`Application`/`AndroidManifest`
   by hand.

Turning **Enable Share** off skips all of the above; **Force overwrite the
Share library** controls whether a re-run replaces files you may have
hand-edited inside the already-built `proj/libshare` (on by default — turn
it off only if you're intentionally patching the built output and don't
want your changes clobbered by the next build).

## Permissions / Capabilities

No `<uses-permission>` entries are required or added by this extension.
Sharing goes through `Intent.ACTION_SEND`, which runs in the target app's
own process with the target app's own permissions — your app never touches
the network, contacts, or storage permissions of whatever the user picks.

Two manifest `<provider>` entries are added automatically inside
`libshare`'s own `AndroidManifest.xml` (merged into the final app manifest
by the Gradle manifest merger — no manual editing needed):

| Provider | Authority | Purpose |
| --- | --- | --- |
| `com.cocos.share.ShareFileProvider` | `${applicationId}.sharefileprovider` | A [`FileProvider`](https://developer.android.com/reference/androidx/core/content/FileProvider) that turns the absolute file path you pass to `shareFile`/`shareImage` into a `content://` URI, so the extension never needs `MANAGE_EXTERNAL_STORAGE`, legacy `WRITE_EXTERNAL_STORAGE`, or a `file://` URI (blocked by `FileUriExposedException` on modern Android for cross-app sharing). |
| `com.cocos.share.ShareInitProvider` | `${applicationId}.shareinit` | A no-op `ContentProvider` whose only job is running its `onCreate()` before `Application.onCreate()`, which is the earliest reliable hook available without editing `Application`/`MainActivity` — used to register the native `"share"` bridge listener. |

Both providers declare `exported="false"`; `ShareFileProvider` also declares
`grantUriPermissions="true"` so the receiving app gets temporary read access
to exactly the one URI it was handed, nothing else.

`share_file_provider_paths.xml` exposes the whole of the app's files and
cache roots (`<files-path path="/" name="filesRoot"/>` and
`<cache-path path="/" name="cacheRoot"/>`), so any file written under
`native.fileUtils.getWritablePath()` or the app's cache directory can be
shared without extra configuration.

## The completion heuristic, in detail

This is the Android-specific mechanics behind the platform note in the
[main index](../index.md#share-result-reliability--read-this-before-you-branch-on-it).
The `Intent` system gives no direct signal for "did the share actually
happen", so `ShareServiceHub` combines two independent signals and reports
whichever fires first:

1. **Chosen-component broadcast (best case).** The chooser is built with
   `Intent.createChooser(intent, title, chosenComponentIntentSender)`, where
   `chosenComponentIntentSender` wraps a one-shot `BroadcastReceiver`
   registered right before `startActivity`. If the OS delivers this
   broadcast, `ShareServiceHub` reads the real `ComponentName` the user
   picked and reports `'completed'` with `activityType` set to that
   component's flattened short string (e.g.
   `"com.whatsapp/.ShareActivity"`). On API 34+ the receiver is registered
   with `RECEIVER_NOT_EXPORTED`, since it only needs to hear from the
   system. On API 31 (`S`) and above, the wrapping `PendingIntent` needs
   `FLAG_MUTABLE` — the OS rewrites the intent's extras before delivering
   it, and an immutable `PendingIntent` would silently fail to receive the
   component name.
2. **Activity-resume fallback.** Not every app on every OEM skin reliably
   triggers the broadcast above. As a safety net, `ShareServiceHub` also
   registers an `Application.ActivityLifecycleCallbacks` and watches when
   your game's activity next resumes:
   - Resumes **within** `customThresholdMs` (default `1000`) of the chooser
     launching → treated as `'canceled'` (the user likely backed out of the
     chooser before picking anything), `activityType: null`.
   - Resumes **after** that window, and the broadcast hasn't already
     answered → treated as `'completed'` with
     `activityType: "UnknownActivity"` — the extension knows the user
     probably interacted with something, just not what.

   Whichever signal answers first wins; the other is ignored once a
   response has been sent (guarded by the same `_pending` flag that also
   powers `E_SHARE_IN_PROGRESS`).

Tune `customThresholdMs` up if your target apps are consistently slow to
open (e.g. cold-starting a heavy social app on a low-end device might take
longer than 1 second, which could otherwise misclassify a real share as
`'canceled'`).

## Build Configuration

- **Module**: `proj/libshare`, Gradle `namespace 'com.cocos.share'`.
- **minSdkVersion / targetSdkVersion / compileSdkVersion**: inherited from
  your project's global Android build properties (`PROP_MIN_SDK_VERSION`
  etc.) — the extension does not hardcode or raise your floor.
- **Dependencies**: `implementation project(':libcocos')` (the engine's own
  module) and `implementation 'androidx.core:core:1.13.1'` (Apache 2.0,
  resolved from Google's Maven repository at build time — see
  [`THIRD_PARTY_NOTICES.md`](../../../../../THIRD_PARTY_NOTICES.md); not
  committed to this repository).
- **File attachment paths**: pass the raw absolute path from
  `native.fileUtils.getWritablePath()` (or your own cache directory) with no
  `file://` prefix — see the note under `shareFile` in the
  [main API reference](../index.md#sharesharefileoptions-sharefileoptions-promiseshareresult).
  A `file://`-prefixed path fails Android's literal `new File(filePath)`
  existence check and rejects with `E_SHARE_FAILED`.

## Known Limitations

- `'completed'` on Android is a best-effort classification, not a delivery
  guarantee — see [Share result
  reliability](../index.md#share-result-reliability--read-this-before-you-branch-on-it).
- Only one share sheet may be open at a time; a second call while one is
  pending rejects immediately with `E_SHARE_IN_PROGRESS`.
- No runtime permission prompts are ever shown by this extension — if that
  surprises you, it's because none are needed (see Permissions above).
- `title` sets the Android chooser's title bar; there is no equivalent
  concept to suppress or restyle it beyond what `Intent.createChooser`
  itself supports.
