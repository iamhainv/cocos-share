# Cocos Share — iOS (English)

## What the extension does for you

When **Enable Share** is on for the iOS tab, the build hook:

1. Copies `template/ios/share` (the `ShareServiceHub.h`/`.mm` ObjC static
   library and its `share.cmake`) into the built project's `proj/share`
   directory.
2. Copies `Pre-share.cmake` (intentional no-op, kept only so the copy logic
   mirrors every other extension's pre/post hook pair) and `Post-share.cmake`
   (includes `proj/share/share.cmake` if present) into `native/engine/ios/`.
3. `share.cmake` links `UIKit.framework` (already linked by the Cocos engine
   itself, so this is defensive, not additive) and force-loads the static
   library into the final executable via the `-ObjC` flag, with ARC forced
   per-file — no Swift runtime and no `.xcframework` are involved.

**No manual `AppDelegate.mm` edit is required.** The base Cocos template's
`AppDelegate.mm` already contains:

```objc
#if __has_include("ShareServiceHub.h")
#import "ShareServiceHub.h"
#endif
```

together with a matching guarded call to `[[ShareServiceHub sharedInstance]
initShareService]` inside `application:didFinishLaunchingWithOptions:`. This
`#if __has_include` guard is a no-op when the header isn't present (Share
disabled or not installed) and automatically activates once the build hook
above copies the header in — the same pattern used by every other native
extension in this family (Deeplink, IAP, Firebase, AdMob, In-App Review,
Notification Scheduler). If you're auditing the generated Xcode project,
this is where to look; you should not need to add or change anything there
yourself.

Turning **Enable Share** off removes the copied CMake integration files on
the next build, so the `#if __has_include` guard falls back to its inert
branch. **Force overwrite the Share library** (on by default) controls
whether a re-run replaces files you may have hand-edited inside the
already-built `proj/share` — turn it off only if you're intentionally
patching the built output.

## Permissions / Capabilities

No `Info.plist` keys, entitlements, or capability toggles are required by
this extension. `UIActivityViewController` runs the target app's own
extension in its own process — for example, Photos or Contacts access (if a
target activity needs it) is negotiated by *that* activity, not by your app,
so nothing needs to be declared in your app's `Info.plist` on Share's
behalf.

The one behavior worth knowing about: on iPad, `UIActivityViewController`
**must** be presented from a `UIPopoverPresentationController` with a
concrete `sourceView`/`sourceRect`, or `UIKit` throws an exception at
present time. `ShareServiceHub` sets this up for you automatically
(anchored to the topmost view controller's view), so you don't need to pass
any anchor information from your game code — just be aware this is why the
native implementation needs a real, on-screen view controller to present
from, which is also the source of the `E_SHARE_FAILED` case described below.

## Completion feedback, in detail

This is the iOS-specific half of the platform note in the [main
index](../index.md#share-result-reliability--read-this-before-you-branch-on-it).
Unlike Android, `UIActivityViewController` gives a real completion callback:

```objc
controller.completionWithItemsHandler = ^(UIActivityType activityType,
                                           BOOL completed,
                                           NSArray *returnedItems,
                                           NSError *activityError) {
    // completed == YES  -> 'completed', activityType is the real activity id
    // completed == NO   -> 'canceled',  activityType: null
    // activityError set -> E_SHARE_FAILED
};
```

For Apple's own built-in activities (Mail, Messages, "Copy", "Save Image",
AirDrop, etc.) this is accurate: `completed` genuinely reflects whether the
user went through with the action. The caveat is **third-party share
extensions** (installed apps that register a `UIActivityViewController`
extension, e.g. many social and chat apps): iOS does not force them to
report `completed`/`activityType` correctly, so you may occasionally see
`completed = NO` even after the user finished sharing in that app, or
`activityType` reported as `null` even on a `'completed'` result. There is
no workaround on the Cocos Share side for this — it's a platform-level
trust boundary between your app and the third-party extension.

`excludedActivityTypes` is preset to `[Print, AssignToContact,
AddToReadingList, MarkupAsPDF]` — these rarely make sense for the kind of
lightweight text/file/image sharing this extension targets, and hiding them
keeps the sheet less cluttered. There is currently no build-panel or
runtime option to change this list; if you need a different set, edit
`ShareServiceHub.mm` directly and rebuild.

## Build Configuration

- **Target**: `proj/share`, a pure Objective-C static library (`add_library`
  in `share.cmake`), ARC forced per-file.
- **Deployment target**: iOS 13.0+ (matches this extension's stated
  compatibility; not independently raised beyond whatever your project
  already targets).
- **Dependencies**: `UIKit.framework` only — no Swift runtime, no
  `.xcframework`, no CocoaPods/SPM package. See
  [`THIRD_PARTY_NOTICES.md`](../../../../../THIRD_PARTY_NOTICES.md).
- **`filePath` handling**: `ShareServiceHub.mm` defensively strips a leading
  `file://` prefix from `filePath` if present before resolving the file URL.
  This is more forgiving than Android (which does not strip that prefix and
  fails outright) — but don't rely on it; always pass the raw absolute path
  for cross-platform consistency, per the [main API
  reference](../index.md#sharesharefileoptions-sharefileoptions-promiseshareresult).
- **`title`**: parsed from the call arguments but not used for anything on
  iOS — there is no chooser-title concept in `UIActivityViewController`; it
  only affects Android's chooser title bar.
- **`customThresholdMs`**: accepted for API symmetry but silently ignored —
  iOS always uses the real `completionWithItemsHandler`, so no
  activity-lifecycle heuristic is needed here.

## Known Limitations

- Third-party share extensions may report inaccurate `completed`/
  `activityType` values — see [Completion feedback, in
  detail](#completion-feedback-in-detail) above. Apple's own built-in
  activities are reliable; anything else is best-effort.
- Only one share sheet may be open at a time; a second call while one is
  pending rejects immediately with `E_SHARE_IN_PROGRESS`.
- Presenting requires a real, on-screen root/presented view controller;
  calling share APIs before the app has a visible window (e.g. extremely
  early in launch) can fail with `E_SHARE_FAILED`.
- No `Info.plist` capability declarations exist to opt out of specific
  built-in activity types beyond the fixed `excludedActivityTypes` list
  baked into `ShareServiceHub.mm`.
