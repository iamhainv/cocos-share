# Cocos Share

[![CI](https://github.com/iamhainv/cocos-share/actions/workflows/ci.yml/badge.svg)](https://github.com/iamhainv/cocos-share/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

[English](#english) | [中文](#中文)

---

<a id="english"></a>
## English

A Cocos Creator 3.8.x extension that opens the native share sheet on iOS
(`UIActivityViewController`) and Android (Intent chooser) — share plain
text, files, and images from your game with a small async TypeScript API.

### Features

- `share.shareText(options)` — share plain text (title/subject/content).
- `share.shareFile(options)` — share any file by absolute native path + MIME type.
- `share.shareImage(options)` — convenience wrapper around `shareFile` for images.
- Promise-based API; resolves with `{ result: 'completed' | 'canceled', activityType }`.
- Graceful degradation on web/editor preview: calls reject with
  `{ code: 'E_NOT_SUPPORTED' }` instead of throwing or crashing.
- No third-party native dependencies — wraps the platform share UI directly.

### Demo

A runnable demo lives at the project root:

- Scene: [`assets/scene/main.scene`](./assets/scene/main.scene)
- Script: [`assets/script/test/ShareTest.ts`](./assets/script/test/ShareTest.ts)

Open this repo as a Cocos Creator 3.8.x project, open `main.scene`, and run
it on an Android or iOS device/simulator build. It builds its whole UI in
code (three buttons: Share Text / Share Image / Share File) so the example
is readable in one file. On web preview it shows a status message instead
of attempting to share, since native sharing isn't available there.

> **Known first-open caveat**: `main.scene` was hand-authored (not saved by
> the Creator GUI), and the `ShareTest` component is referenced by the
> script asset's full UUID rather than Creator's internal compressed script
> id. If Creator shows a "script asset lost" / missing-script warning on the
> `Content` node the first time you open the project, just re-drag
> `assets/script/test/ShareTest.ts` onto that node in the Inspector and
> re-save the scene — a one-time fix; only the `Content` node is affected,
> nothing else is at risk.

### Compatibility

| Cocos Creator | Android | iOS | Web |
| --- | --- | --- | --- |
| >= 3.8.0 | Yes | Yes | Preview only (native features degrade gracefully) |

### Installation

1. Copy `extensions/Share` into your project's `extensions/` folder.
2. Restart Cocos Creator, or use **Extension → Extension Manager** to enable it.
3. Import from the extension's asset-db mount:
   ```ts
   import { share, MIME_TYPE_IMAGE } from 'db://share/index';

   await share.shareText({ content: 'Hello from my game!' });
   ```
4. See the full documentation: [doc/en](./extensions/Share/doc/en/index.md)

### Documentation

- English: [extensions/Share/doc/en/index.md](./extensions/Share/doc/en/index.md)
- 中文: [extensions/Share/doc/zh/index.md](./extensions/Share/doc/zh/index.md)

### License

MIT — see [LICENSE](./LICENSE).

### Trademarks

This project is an independent, community-maintained wrapper and is **not
affiliated with, endorsed by, or sponsored by** Cocos, Google, or Apple.
"Cocos Creator", "AdMob", "Firebase", "Google Play" and "App Store" are
trademarks of their respective owners.

---

<a id="中文"></a>
## 中文

一个 Cocos Creator 3.8.x 扩展，用于调起 iOS（`UIActivityViewController`）和
Android（Intent 分享选择器）的原生分享面板 —— 通过一套小巧的异步
TypeScript API 分享文本、文件和图片。

### 功能特性

- `share.shareText(options)` —— 分享纯文本（标题/主题/正文）。
- `share.shareFile(options)` —— 通过绝对原生路径 + MIME 类型分享任意文件。
- `share.shareImage(options)` —— `shareFile` 的图片分享便捷封装。
- 基于 Promise 的 API，成功后返回 `{ result: 'completed' | 'canceled', activityType }`。
- Web/编辑器预览下优雅降级：调用会以 `{ code: 'E_NOT_SUPPORTED' }` 拒绝，而不是抛出异常或崩溃。
- 无第三方原生依赖，直接封装平台自带的分享界面。

### 演示

项目根目录内置了一个可直接运行的演示：

- 场景：[`assets/scene/main.scene`](./assets/scene/main.scene)
- 脚本：[`assets/script/test/ShareTest.ts`](./assets/script/test/ShareTest.ts)

用 Cocos Creator 3.8.x 打开本仓库作为项目，打开 `main.scene`，然后构建到
Android 或 iOS 设备/模拟器运行。界面完全由代码构建（三个按钮：分享文本 /
分享图片 / 分享文件），方便在单个文件中读懂整个示例。Web 预览下会显示状态
提示而不会尝试真正分享，因为原生分享在 Web 上不可用。

> **首次打开的已知注意事项**：`main.scene` 是手工编写的（并非通过 Creator
> 编辑器保存），其中 `ShareTest` 组件是通过脚本资源的完整 UUID 引用的，而
> 不是 Creator 内部的压缩脚本 ID。如果首次打开项目时 Creator 在 `Content`
> 节点上提示"脚本丢失"之类的警告，只需将
> `assets/script/test/ShareTest.ts` 重新拖拽到该节点的 Inspector 面板上并
> 重新保存场景即可 —— 这是一次性修复，只影响 `Content` 节点，不会影响项目
> 其他部分。

### 兼容性

| Cocos Creator | Android | iOS | Web |
| --- | --- | --- | --- |
| >= 3.8.0 | 支持 | 支持 | 仅预览（原生功能会优雅降级） |

### 安装

1. 将 `extensions/Share` 复制到项目的 `extensions/` 目录下。
2. 重启 Cocos Creator，或通过 **扩展 → 扩展管理器** 启用该扩展。
3. 从扩展的 asset-db 挂载路径导入：
   ```ts
   import { share, MIME_TYPE_IMAGE } from 'db://share/index';

   await share.shareText({ content: 'Hello from my game!' });
   ```
4. 查看完整文档：[doc/zh](./extensions/Share/doc/zh/index.md)

### 文档

- English: [extensions/Share/doc/en/index.md](./extensions/Share/doc/en/index.md)
- 中文: [extensions/Share/doc/zh/index.md](./extensions/Share/doc/zh/index.md)

### 许可证

MIT — 详见 [LICENSE](./LICENSE)。

### 商标声明

本项目为独立的社区维护封装库，**与 Cocos、Google、Apple 均无关联，未获得其
认可或赞助**。"Cocos Creator"、"AdMob"、"Firebase"、"Google Play" 与
"App Store" 均为其各自所有者的商标。
