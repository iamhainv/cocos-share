# Third-Party Notices

Cocos Share may bundle or depend on third-party software. Their licenses are
reproduced below (or referenced) as required by their respective terms.

This extension does not vendor or commit any third-party binaries. It links
one Gradle-resolved Android library (fetched from Google's Maven repository
at build time, not committed to this repository) and one stock Apple system
framework on iOS (no third-party code at all).

| Component | Version | License | Notes |
| --- | --- | --- | --- |
| AndroidX Core (`androidx.core:core`) | 1.13.1 | Apache License 2.0 | Declared as a Gradle dependency in `extensions/Share/template/android/libshare/build.gradle`; resolved from Google's Maven repository at build time. Verified against the published POM (`https://maven.google.com/androidx/core/core/1.13.1/core-1.13.1.pom`), which declares `The Apache Software License, Version 2.0`. Not vendored in this repository. License: https://www.apache.org/licenses/LICENSE-2.0 |
| Apple `UIKit.framework` | iOS SDK (system) | Apple SDK license (part of Xcode/iOS SDK) | Linked in `extensions/Share/template/ios/share/share.cmake` for the native share-sheet (`UIActivityViewController`) bridge. Ships with Xcode; not distributed by this repository. |

The Android and iOS native bridges under `extensions/Share/template/` are
this project's own source code (`ShareServiceHub.h`/`.mm` on iOS, the
`libshare` sources on Android); no third-party native code is bundled.
