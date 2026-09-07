# Changelog

All notable changes to this extension will be documented in this file.

## 1.0.0 — Initial release

- Initial open-source release of Cocos Share.
- Native share sheet on iOS (`UIActivityViewController`) and Android (Intent chooser).
- `share.shareText()`, `share.shareFile()`, `share.shareImage()` — Promise-based API.
- Graceful degradation on web/editor preview (`E_NOT_SUPPORTED` rejection instead of a crash).
- Demo scene and runtime-built test UI at `assets/scene/main.scene` / `assets/script/test/ShareTest.ts`.
