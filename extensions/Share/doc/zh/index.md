# Cocos Share（中文）

一个 Cocos Creator 3.8.x 扩展，用于唤起系统原生的分享面板——iOS 上是
`UIActivityViewController`，Android 上是 Intent 选择器——让你的游戏可以把
纯文本、文件和图片分享到用户安装的任意 App（短信、邮件、WhatsApp、
"复制到剪贴板" 等），而无需为每个目标 App 单独接入。原生分享逻辑移植自
开源项目 `godot-share` 插件，并适配到 Cocos Creator 的原生 JS 桥接层；
不捆绑任何第三方原生依赖。

## 兼容性

| Cocos Creator | Android | iOS | Web / 编辑器预览 |
| --- | --- | --- | --- |
| >= 3.8.0（基于 3.8.8 构建和测试） | minSdk 继承自项目全局 Android 构建配置——扩展本身除 `androidx.core:core:1.13.1` 所要求的版本外，不额外设置下限 | iOS 13.0+ | 不支持 —— 所有 API 调用都会以 `E_NOT_SUPPORTED` 拒绝 |

## 分享结果的可靠性——请在依赖它做判断之前阅读本节

> **`'completed'` 结果并不能证明内容真的被发送出去了——在 Android 上尤其
> 如此。** 两个平台的分享面板在设计上都会保护用户隐私、不让调用方 App
> 得知太多细节，这也意味着两边都无法给出完全可信的“已送达”信号。
>
> - **Android。** `Intent` 系统本身没有任何 API 能报告分享是否真正完成。
>   本扩展在启动选择器的同时，会附带一个一次性的 `PendingIntent`，供
>   Android 在用户选定目标后回调（`EXTRA_CHOSEN_COMPONENT_INTENT_SENDER`）
>   ——一旦这个回调触发，你会拿到真实的 `activityType` 和 `'completed'`
>   结果。但并非所有目标 App 都会触发这个回调，因此扩展还准备了一个兜底
>   方案：监测游戏所在 Activity 何时恢复前台——如果在选择器启动后的
>   `customThresholdMs`（默认 1000 毫秒）内就恢复，判定为 `'canceled'`；
>   超过这个时间窗口后才恢复，则判定为 `'completed'`，`activityType` 为
>   `"UnknownActivity"`。**简而言之：Android 上的 `'completed'` 只代表
>   "用户选定了某个目标，或者至少没有立刻退出选择器"——它并不能证明消息
>   真的被发送、或者内容真的被发布了。**
> - **iOS。** `UIActivityViewController` 的完成回调对苹果自带的活动
>   （邮件、信息、"复制"、"存储图像" 等）能给出真实可靠的完成状态。但
>   第三方分享扩展并不强制要求准确上报——即便用户已经完成了分享，它们仍
>   可能报告 `completed = NO`，或者干脆不提供 `activityType`（这种情况下
>   你会在 `'completed'` 结果上看到 `activityType: null`）。
>
> **不要把奖励、成就或数据统计的转化判定绑定在 `result === 'completed'`
> 上。** 请把它当作 "用户与分享面板发生了交互" 的尽力而为信号，而不是一份
> 送达回执。

## 安装

1. 将 `extensions/Share` 复制到项目的 `extensions/` 目录下。
2. 在终端中构建一次扩展：
   ```bash
   cd extensions/Share
   npm install
   npm run build
   ```
   （如果你已经拥有仓库中提交的 `dist/`，这一步不是必需的——本仓库已提交
   编译好的 `dist/`，只有你修改了 `source/` 之后才需要这一步。）
3. 重启 Cocos Creator，或通过 **扩展 → 扩展管理器** 启用该扩展（名称为
   **Share**）。
4. 打开 **项目 → 构建发布**，选择 **Android** 和/或 **iOS** 平台标签页，
   确认 **启用 Share** 已勾选（默认开启——见下方 [构建面板选项](#构建面板选项)）。
5. 从扩展的 asset-db 挂载路径导入运行时 API：
   ```ts
   import { share } from 'db://share/index';
   ```

## 构建面板选项

**Android** 和 **iOS** 标签页都暴露同样的两个选项，且**在每个平台上各自
独立配置**——例如你可以在 Android 上启用 Share，同时在 iOS 上禁用它。

| 选项 | 默认值 | 说明 |
| --- | --- | --- |
| **启用 Share**（`enableShare`） | `true` | 该平台构建的总开关。开启时，原生 `libshare` 模块（Android）或 CMake 集成文件与桥接源码（iOS）会被拷贝进构建产物；关闭时不会添加任何 Share 代码——在 iOS 上还会移除上一次构建遗留的 CMake 集成文件。 |
| **强制覆盖 Share 库文件**（`overwriteLibrary`） | `true` | 每次构建都用扩展模板中的文件覆盖构建产物中已存在的原生库文件。关闭可保留你直接对构建产物做的手动修改（不建议用于 CI）。 |

## API 参考

从扩展的 asset-db barrel 统一导入：

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

`share` 是一个开箱即用的 `ShareClient` 单例；通常不需要自己再实例化
`ShareClient`。所有方法均为异步，成功时以 `ShareResult` resolve，失败时以
`ShareError` 拒绝。调用**没有超时限制**——底层原生桥接对分享调用专门关闭
了默认的 30 秒超时，因为响应只有在用户关闭分享面板之后才会到来，而这个
时间长短完全不可预期。

同一时间只能有一个分享面板处于打开状态；在上一次调用尚未返回结果之前
再次调用这三个方法中的任意一个，都会立即以
`{ code: 'E_SHARE_IN_PROGRESS' }` 拒绝。

### `share.shareText(options: ShareTextOptions): Promise<ShareResult>`

用纯文本内容打开系统原生分享面板。

```ts
const result = await share.shareText({
    title: '快来看看这个',      // 仅用于 Android 选择器标题，iOS 上会被忽略
    subject: '来自我的游戏',    // 用户选择邮件类 App 时会用到
    content: '我刚刚在 MyApp 中通过了第 12 关！',
});
```

### `share.shareFile(options: ShareFileOptions): Promise<ShareResult>`

用文件附件（可附带可选文本正文）打开系统原生分享面板。

```ts
import { native } from 'cc';

const path = native.fileUtils.getWritablePath() + 'report.pdf';
const result = await share.shareFile({
    filePath: path,
    mimeType: 'application/pdf',
    content: '我的周报已附在附件中。',
});
```

`filePath` **必须**是从原生层获取的绝对文件系统路径（例如
`native.fileUtils.getWritablePath()` 拼接文件名，或某次下载所在的缓存
目录）——**不能**是相对路径，也**不能**是 `file://` URI。这一点在 Android
上尤其重要：原生端会直接对该路径执行 `new File(filePath)`，路径不存在时
不会分享任何内容，因此带 `file://` 前缀的字符串在这里会静默失败——即便
iOS 端恰好会防御性地去掉开头的 `file://`。请始终传原始路径。

### `share.shareImage(options: Omit<ShareFileOptions, 'mimeType'>): Promise<ShareResult>`

`shareFile` 的便捷封装，自动将 `mimeType` 设为 `MIME_TYPE_IMAGE`
（`'image/*'`）——完全不需要传入 `mimeType`。

```ts
const path = native.fileUtils.getWritablePath() + 'screenshot.png';
const result = await share.shareImage({
    filePath: path,
    title: '我的最佳战绩',
});
if (result.result === 'completed') {
    console.log('用户与目标发生了交互:', result.activityType);
}
```

### 类型定义

```ts
type ShareResultStatus = 'completed' | 'canceled';

interface ShareResult {
    result: ShareResultStatus;
    /** 用户选定目标的平台标识符，不可用时为 null。 */
    activityType: string | null;
}

interface ShareError {
    code: string;
    message: string;
}

interface ShareTextOptions {
    title?: string;          // 仅用于 Android 选择器标题，iOS 上会被忽略
    subject?: string;        // 目标为邮件类 App 时会用到
    content: string;         // 必填
    customThresholdMs?: number; // 仅 Android 完成状态判定的阈值，默认 1000
}

interface ShareFileOptions extends Omit<ShareTextOptions, 'content'> {
    content?: string;        // 随文件一起附带的可选文本正文
    filePath: string;        // 必填，绝对原生路径——见上文 shareFile 说明
    mimeType: string;        // 必填，例如 'application/pdf'
}
```

`activityType` 示例：

- iOS —— `"com.apple.UIKit.activity.Mail"`、
  `"com.apple.UIKit.activity.CopyToPasteboard"`，或者平台无法提供时为
  `null`。
- Android —— 类似 `"com.whatsapp/.ShareActivity"` 的扁平化组件名，
  生命周期兜底方案触发时为 `"UnknownActivity"`，`'canceled'` 时为
  `null`。

### `MIME_TYPE_TEXT` / `MIME_TYPE_IMAGE`

```ts
const MIME_TYPE_TEXT = 'text/plain';
const MIME_TYPE_IMAGE = 'image/*';
```

`MIME_TYPE_TEXT` 提供出来仅作参考/保持一致性——`shareText()` 从不携带任何
`mimeType`，原生端会自行默认使用 `"text/plain"`。`MIME_TYPE_IMAGE` 才是
`shareImage()` 内部实际使用的值。

### 错误码

| 错误码 | 含义 |
| --- | --- |
| `E_NOT_SUPPORTED` | 在非原生平台（web/编辑器）上调用，或者原生桥接收到了无法识别的方法名。 |
| `E_SHARE_IN_PROGRESS` | 已有一个分享面板处于打开状态；请等它返回结果后再次调用。 |
| `E_SHARE_FAILED` | 原生侧失败：没有可用于展示的 Activity/视图控制器、`filePath` 指向的文件不存在、`FileProvider` 无法映射该文件（Android），或系统拒绝启动分享 Activity。`message` 携带平台自身给出的描述信息。 |
| `E_TIMEOUT` | 桥接通用超时机制所声明的错误码，但**在 `ShareClient` 中不会被触发**——分享调用始终关闭超时（见 API 参考开头说明）。之所以列在这里，是因为它属于 `ShareError` 的通用错误码词汇表。 |
| `E_INVALID_ARGS` | 类型定义中为参数缺失/格式错误预留的错误码；两端原生实现目前均未实际抛出（两个平台都将缺失的可选字段视为"未提供"而非报错）。 |
| `E_DEVELOPER_ERROR` | 仅 Android——原生桥接收到了无法解析的 JSON 数据包，说明桥接接线本身有问题，而非正常使用中会出现的情况。 |

## 示例

完整可运行的演示位于仓库根目录：

- 场景：[`assets/scene/main.scene`](../../../../assets/scene/main.scene)
- 脚本：[`assets/script/test/ShareTest.ts`](../../../../assets/script/test/ShareTest.ts)

整个 UI 都在代码中搭建（分享文本 / 分享图片 / 分享文件三个按钮），因此
整个示例只有一个文件，同时展示了如何在分享之前把演示用的文件/图片写入
可写路径：

```ts
import { native } from 'cc';
import { share } from 'db://share/index';
import type { ShareError, ShareResult } from 'db://share/index';

async function shareScreenshot(pngBytes: Uint8Array) {
    const path = native.fileUtils.getWritablePath() + 'screenshot.png';
    const ok = (native.fileUtils as any).writeDataToFile(pngBytes.buffer, path);
    if (!ok) {
        throw { code: 'E_LOCAL_WRITE_FAILED', message: `写入 ${path} 失败` };
    }

    try {
        const result: ShareResult = await share.shareImage({
            title: '我的最佳战绩',
            filePath: path,
        });
        console.log('分享结果:', result.result, result.activityType);
    } catch (e) {
        const err = e as ShareError;
        if (err.code === 'E_NOT_SUPPORTED') {
            console.log('仅原生平台支持分享——请构建到 Android/iOS 后再试');
        } else {
            console.warn('分享失败:', err.code, err.message);
        }
    }
}
```

## 故障排查

- **每次调用都以 `E_NOT_SUPPORTED` 拒绝** —— 你正在编辑器或 Web 预览环境中
  运行。原生分享功能只存在于 Android/iOS 构建产物中；此时演示的状态标签
  会显示一条友好提示，而不是直接崩溃。
- **`shareFile`/`shareImage` 以 `E_SHARE_FAILED: File does not exist`
  拒绝，但文件确实存在（Android）** —— 你很可能传入了带 `file://` 前缀的
  字符串或相对路径。Android 会直接对路径执行 `new File(filePath)` 检查，
  不做任何归一化处理；请传入来自
  `native.fileUtils.getWritablePath()`（或你实际写入文件的位置）的原始
  绝对路径，不要带 `file://` 前缀。
- **构建面板显示原始的 `i18n:share.xxx` 字符串而不是标签** —— 说明
  `i18n/en.js` / `i18n/zh.js` 缺少 `source/builder.ts` 用到的某个 key。
  `i18n/*.js` 未经编译，修改后无需 `npm run build`，但 Creator 可能有
  缓存，需要 **开发者 → 重新加载扩展**。
- **Gradle 同步失败，提示 "project ':libshare' not found"** ——
  `settings.gradle` 片段没有被注入。请确认 Android 标签页的
  **启用 Share** 已开启并重新构建；检查
  `native/engine/android/app/build.gradle` 与构建产物中的
  `settings.gradle` 是否都包含自动生成的 `libshare` 相关行。
- **Android 构建出现 "Duplicate class"** —— 通常是与另一个同样声明了
  相同包名的扩展原生库混用导致的。`libshare` 使用独立包名
  `com.cocos.share`，正常情况下不会发生，除非你手动把它的 Java 源码
  复制到了别处。
- **CMake 报错：找不到 target `share` / target 重复（iOS）** —— 确认
  `native/engine/ios/` 下只存在一份 `Pre-share.cmake` /
  `Post-share.cmake`（此前若曾以 **启用 Share** 关闭构建过应已自动删除；
  若未删除，手动删除后重新构建）。
- **iOS 上分享面板始终不弹出** —— 检查 Xcode 控制台中的
  `[ShareServiceHub]` 日志。如果从未出现
  `initShareService — channel share registered`，说明
  `AppDelegate.mm` 中的 `#if __has_include("ShareServiceHub.h")` 没有
  找到对应头文件，也就意味着桥接源码没有被拷贝进 `proj/share`——请在
  **启用 Share** 开启的状态下重新构建。
- **演示场景出现一次性的"脚本丢失"警告** —— 参见根目录
  [README](../../../../README.md#演示) 中的说明。

## 已知限制

- **Android 的 `'completed'` 结果是尽力而为的启发式判断，不是送达保证**
  —— 详见上文[分享结果的可靠性](#分享结果的可靠性请在依赖它做判断之前阅读本节)。
  这是在把分享结果接入游戏逻辑之前，最需要理解清楚的一点。
- 两个平台都只允许同时进行一次分享操作；已有一次分享未结束时再次调用会
  立即以 `E_SHARE_IN_PROGRESS` 拒绝，而不是排队等待。
- `title` 参数在 `shareText`/`shareFile`/`shareImage` 中都会被接受，但
  **在 iOS 上会被忽略**——`UIActivityViewController` 没有选择器标题这个
  概念；它只会影响 Android 选择器的标题栏。
- `customThresholdMs` **仅对 Android 有效**，iOS 上会被静默忽略（iOS
  始终使用真实的完成回调，不需要这套启发式方案）。
- 不存在 Web 或编辑器预览的实现；这些平台上的所有调用都会以
  `E_NOT_SUPPORTED` 拒绝。
- 关闭 **启用 Share** 不会追溯性地移除此前已注入到构建产物中的原生代码
  ——如需完全干净的状态，请对原生项目执行 clean build（或手动删除
  `proj/share` / `proj/libshare` 以及对应的 CMake 集成文件）。
