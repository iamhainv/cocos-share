# Cocos Share (English)

A Cocos Creator 3.8.x extension that opens the platform's native share sheet
— `UIActivityViewController` on iOS, the Intent chooser on Android — so your
game can share plain text, files, and images through whatever apps the user
has installed (Messages, Mail, WhatsApp, "Copy to clipboard", etc.), without
you writing any per-app integration. The native share logic is ported from
the open-source `godot-share` plugin and adapted to the Cocos Creator native
JS bridge; no third-party native dependency is vendored.

## Compatibility

| Cocos Creator | Android | iOS | Web / Editor preview |
| --- | --- | --- | --- |
| >= 3.8.0 (built and tested against 3.8.8) | minSdk inherited from your project's global Android build settings — the extension sets no floor of its own beyond what `androidx.core:core:1.13.1` requires | iOS 13.0+ | Not supported — every API call rejects with `E_NOT_SUPPORTED` |

## Share result reliability — read this before you branch on it

> **A `'completed'` result is not proof the content was actually sent —
> especially on Android.** Both platforms' share sheets are designed to
> protect the user's privacy from the calling app, which means neither one
> gives you a fully trustworthy "yes, it was delivered" signal.
>
> - **Android.** The `Intent` system has no API that reports whether a share
>   actually completed. This extension launches the chooser together with a
>   one-shot `PendingIntent` that Android calls back with the component the
>   user picked (`EXTRA_CHOSEN_COMPONENT_INTENT_SENDER`) — when that callback
>   fires, you get the real `activityType` and a `'completed'` result. Some
>   target apps never trigger that callback, so as a fallback the extension
>   also watches whether your game's activity resumes: if it resumes within
>   `customThresholdMs` (default 1000&nbsp;ms) of the chooser launching, the
>   share is reported as `'canceled'`; if it resumes after that window, it is
>   reported as `'completed'` with `activityType: "UnknownActivity"`. **In
>   short: `'completed'` on Android means "the user picked a target, or at
>   least didn't back out immediately" — it is not confirmation that a
>   message was actually sent or a post was actually published.**
> - **iOS.** `UIActivityViewController`'s completion handler gives genuine
>   completion feedback for Apple's built-in activities (Mail, Messages,
>   "Copy", "Save Image", etc.). Third-party share extensions are not
>   required to report accurately and may report `completed = NO` even after
>   completing the action, or omit `activityType` entirely (you'll see
>   `activityType: null` on a `'completed'` result in that case).
>
> **Do not gate rewards, achievements, or analytics conversions on
> `result === 'completed'`.** Treat it as a best-effort "the user engaged
> with the sheet" signal, not a delivery receipt.

## Installation

1. Copy `extensions/Share` into your project's `extensions/` folder.
2. From a terminal, build the extension once:
   ```bash
   cd extensions/Share
   npm install
   npm run build
   ```
   (Not required if you already have the committed `dist/` — this repo ships
   a pre-built `dist/`, so step 2 is only needed after you edit `source/`.)
3. Restart Cocos Creator, or use **Extension → Extension Manager** to enable
   the extension (look for **Share**).
4. Open **Project → Build**, select the **Android** and/or **iOS** platform
   tab, and confirm **Enable Share** is checked (it is on by default — see
   [Build Panel Options](#build-panel-options)).
5. Import the runtime API from the extension's asset-db mount:
   ```ts
   import { share } from 'db://share/index';
   ```

## Build Panel Options

Both the **Android** and **iOS** tabs of the build panel expose the same two
options, each configured **independently per platform** — for example, you
can leave Share enabled on Android while disabling it on iOS.

| Option | Default | Description |
| --- | --- | --- |
| **Enable Share** (`enableShare`) | `true` | Master switch for this platform's build. When on, the native `libshare` module (Android) or CMake integration + bridge sources (iOS) are copied into the built project. When off, no Share code is added — and on iOS, any CMake integration files from a previous build are removed. |
| **Force overwrite the Share library** (`overwriteLibrary`) | `true` | Overwrite the native library files already present in the built project with the extension's template on every build. Turn off to preserve manual edits you made directly in the built project (not recommended for CI). |

## API Reference

Import everything from the extension's asset-db barrel:

```ts
import { share, ShareClient } from 'db://share/index';
import type {
    ShareResult,
    ShareResultStatus,
    ShareError,
    ShareTextOptions,
    ShareFileOptions,
} from 'db://share/index';
import { MIME_TYPE_TEXT, MIME_TYPE_IMAGE } from 'db://share/index';
```

`share` is a ready-to-use singleton `ShareClient`; there is normally no
reason to construct `ShareClient` yourself. All methods are async, resolve
with a `ShareResult`, and reject with a `ShareError` on failure. Calls have
**no timeout** — the underlying native bridge disables its default 30-second
timeout for share calls, since the response only arrives once the user
closes the share sheet, which can take an arbitrary amount of time.

Only one share sheet may be open at a time; calling any of the three methods
while another is still awaiting a result rejects immediately with
`{ code: 'E_SHARE_IN_PROGRESS' }`.

### `share.shareText(options: ShareTextOptions): Promise<ShareResult>`

Open the native share sheet with plain text.

```ts
const result = await share.shareText({
    title: 'Check this out',      // Android chooser title only; ignored on iOS
    subject: 'From my game',      // used if the user picks a mail app
    content: 'I just beat level 12 in MyApp!',
});
```

### `share.shareFile(options: ShareFileOptions): Promise<ShareResult>`

Open the native share sheet with a file attachment (and optional text body).

```ts
import { native } from 'cc';

const path = native.fileUtils.getWritablePath() + 'report.pdf';
const result = await share.shareFile({
    filePath: path,
    mimeType: 'application/pdf',
    content: 'My weekly report is attached.',
});
```

`filePath` **must** be an absolute native filesystem path obtained from the
native layer (e.g. `native.fileUtils.getWritablePath()` plus a filename, or
a download's cache location) — **not** a relative path and **not** a
`file://` URI. This matters most on Android: the native side does a literal
`new File(filePath)` and shares nothing if that path doesn't exist, so a
`file://`-prefixed string will silently fail there even though the iOS side
happens to strip a leading `file://` defensively. Always pass the raw path.

### `share.shareImage(options: Omit<ShareFileOptions, 'mimeType'>): Promise<ShareResult>`

Convenience wrapper around `shareFile` that sets `mimeType` to
`MIME_TYPE_IMAGE` (`'image/*'`) for you — omit `mimeType` entirely.

```ts
const path = native.fileUtils.getWritablePath() + 'screenshot.png';
const result = await share.shareImage({
    filePath: path,
    title: 'My best run',
});
if (result.result === 'completed') {
    console.log('user engaged with target:', result.activityType);
}
```

### Types

```ts
type ShareResultStatus = 'completed' | 'canceled';

interface ShareResult {
    result: ShareResultStatus;
    /** Chosen target's platform identifier, or null when unavailable. */
    activityType: string | null;
}

interface ShareError {
    code: string;
    message: string;
}

interface ShareTextOptions {
    title?: string;          // Android chooser title only; ignored on iOS
    subject?: string;        // used when the target is a mail app
    content: string;         // required
    customThresholdMs?: number; // Android-only completion heuristic, default 1000
}

interface ShareFileOptions extends Omit<ShareTextOptions, 'content'> {
    content?: string;        // optional text body alongside the file
    filePath: string;        // required, absolute native path — see shareFile above
    mimeType: string;        // required, e.g. 'application/pdf'
}
```

`activityType` examples:

- iOS — `"com.apple.UIKit.activity.Mail"`, `"com.apple.UIKit.activity.CopyToPasteboard"`, or `null` if the platform doesn't expose it.
- Android — a flattened component name such as `"com.whatsapp/.ShareActivity"`, `"UnknownActivity"` when the lifecycle fallback fired instead of the real callback, or `null` on `'canceled'`.

### `MIME_TYPE_TEXT` / `MIME_TYPE_IMAGE`

```ts
const MIME_TYPE_TEXT = 'text/plain';
const MIME_TYPE_IMAGE = 'image/*';
```

`MIME_TYPE_TEXT` is provided for reference/consistency; `shareText()` never
sends a `mimeType` at all — the native side defaults to `"text/plain"` on
its own. `MIME_TYPE_IMAGE` is what `shareImage()` uses internally.

### Error codes

| Code | Meaning |
| --- | --- |
| `E_NOT_SUPPORTED` | Called on a non-native platform (web/editor), or an unrecognized method reached the native bridge. |
| `E_SHARE_IN_PROGRESS` | A share sheet is already open; wait for it to resolve before calling again. |
| `E_SHARE_FAILED` | Native-side failure: no activity/view controller to present from, the file at `filePath` doesn't exist, `FileProvider` couldn't map the file (Android), or the OS declined to start the share activity. `message` carries the platform's own description. |
| `E_TIMEOUT` | Declared by the bridge's general timeout mechanism, but **not reachable through `ShareClient`** — share calls always disable the timeout (see API Reference intro). Included here because it's part of the shared `ShareError` vocabulary. |
| `E_INVALID_ARGS` | Reserved in the type for malformed/missing arguments; not currently emitted by either native implementation (both platforms treat missing optional fields as absent rather than erroring). |
| `E_DEVELOPER_ERROR` | Android only — the native bridge received a JSON envelope it could not parse. Indicates a bug in the bridge wiring, not normal usage. |

## Examples

The full runnable demo lives at the repository root:

- Scene: [`assets/scene/main.scene`](../../../../assets/scene/main.scene)
- Script: [`assets/script/test/ShareTest.ts`](../../../../assets/script/test/ShareTest.ts)

It builds its whole UI in code (three buttons: Share Text / Share Image /
Share File) so the whole example fits in one file, and shows how to write a
demo file/image to the writable path before sharing it:

```ts
import { native } from 'cc';
import { share } from 'db://share/index';
import type { ShareError, ShareResult } from 'db://share/index';

async function shareScreenshot(pngBytes: Uint8Array) {
    const path = native.fileUtils.getWritablePath() + 'screenshot.png';
    const ok = (native.fileUtils as any).writeDataToFile(pngBytes.buffer, path);
    if (!ok) {
        throw { code: 'E_LOCAL_WRITE_FAILED', message: `Failed to write ${path}` };
    }

    try {
        const result: ShareResult = await share.shareImage({
            title: 'My best run',
            filePath: path,
        });
        console.log('share result:', result.result, result.activityType);
    } catch (e) {
        const err = e as ShareError;
        if (err.code === 'E_NOT_SUPPORTED') {
            console.log('native sharing only — build to Android/iOS to try this');
        } else {
            console.warn('share failed:', err.code, err.message);
        }
    }
}
```

## Troubleshooting

- **Every call rejects with `E_NOT_SUPPORTED`** — you're running in the
  Editor or a Web preview. Native sharing only exists in Android/iOS builds;
  the demo's status label shows a friendly message instead of crashing in
  this case.
- **`shareFile`/`shareImage` reject with `E_SHARE_FAILED: File does not
  exist`, but the file is really there (Android)** — you likely passed a
  `file://`-prefixed string or a relative path. Android does a literal
  `new File(filePath)` check with no normalization; pass the raw absolute
  path from `native.fileUtils.getWritablePath()` (or wherever you wrote the
  file), with no `file://` prefix.
- **Build panel shows raw `i18n:share.xxx` strings instead of labels** — the
  `i18n/en.js` / `i18n/zh.js` files are missing a key used by
  `source/builder.ts`. i18n files are not compiled, so editing them doesn't
  need `npm run build`, but a stale Creator cache may need **Developer →
  Reload Extension**.
- **Gradle sync fails with "project ':libshare' not found"** — the
  `settings.gradle` snippet wasn't injected. Confirm **Enable Share** is on
  for the Android tab and rebuild; check that
  `native/engine/android/app/build.gradle` and the built project's
  `settings.gradle` both contain the auto-generated `libshare` lines.
- **"Duplicate class" during an Android build** — usually caused by mixing
  this library with another extension's Android library declaring the same
  package. `libshare` uses the isolated package `com.cocos.share`, so this
  should not happen unless you've manually copied its Java sources
  elsewhere.
- **CMake error: target `share` not found / duplicate target (iOS)** — make
  sure `Pre-share.cmake` / `Post-share.cmake` exist only once under
  `native/engine/ios/` (a previous build with **Enable Share** off should
  have removed them; if not, delete them and rebuild).
- **The share sheet never opens on iOS** — check the Xcode console for
  `[ShareServiceHub]` logs. If `initShareService — channel share registered`
  never appears, the `#if __has_include("ShareServiceHub.h")` guard in
  `AppDelegate.mm` didn't find the header, which means the bridge sources
  weren't copied into `proj/share` — rebuild with **Enable Share** on.
- **One-time "script lost" warning on the demo scene** — see the note in the
  root [README](../../../../README.md#demo).

## Known Limitations

- **Android's `'completed'` result is a best-effort heuristic, not a
  delivery guarantee** — see [Share result
  reliability](#share-result-reliability--read-this-before-you-branch-on-it)
  above. This is the single most important thing to understand before
  wiring share results into game logic.
- Only one share operation may be in flight at a time on both platforms; a
  second call while one is open rejects immediately with
  `E_SHARE_IN_PROGRESS` rather than queuing.
- `title` is accepted by `shareText`/`shareFile`/`shareImage` but is
  **ignored on iOS** — `UIActivityViewController` has no chooser-title
  concept; it only affects the Android chooser's title bar.
- `customThresholdMs` is **Android-only** and is silently ignored on iOS
  (iOS always uses the real completion handler, so no heuristic is needed
  there).
- No web or Editor-preview implementation exists; every call rejects with
  `E_NOT_SUPPORTED` on those targets.
- Disabling **Enable Share** does not retroactively remove native code
  already injected into a previously built project — clean-build the native
  project (or delete `proj/share` / `proj/libshare` and the CMake include
  files) for a fully clean slate.
