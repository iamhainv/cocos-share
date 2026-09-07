# Cocos Share — Android（中文）

## 扩展为你做了什么

当 Android 标签页的 **启用 Share** 开启时，构建钩子会：

1. 把 `template/android/libshare` 作为一个新的 Gradle 模块拷贝进构建产物
   的 `proj/libshare`（Java 源码、`AndroidManifest.xml`、`build.gradle`，
   以及 `share_file_provider_paths.xml` 资源文件）。
2. 幂等地向构建产物的 `settings.gradle` 注入 `include ':libshare'`，向
   `native/engine/android/app/build.gradle` 注入
   `implementation project(':libshare')`（钩子会先检查该行是否已存在
   再追加，因此重复构建不会产生重复内容）。
3. 注册模块自带的 `ShareInitProvider`，它会在 `Application.onCreate()`
   之前运行，并完成原生 `"share"` 桥接通道的注册——你不需要手动改动
   `MainActivity`/`Application`/`AndroidManifest`。

关闭 **启用 Share** 会跳过以上全部步骤；**强制覆盖 Share 库文件**
（默认开启）决定重新构建时是否会用模板覆盖已构建产物中
`proj/libshare` 里可能被你手动改过的文件——只有在你确实想手动修补构建
产物、且不希望下次构建覆盖这些改动时，才需要关闭它。

## 权限 / 能力

本扩展不需要也不会添加任何 `<uses-permission>` 声明。分享通过
`Intent.ACTION_SEND` 完成，这会在目标 App 自己的进程中运行、使用目标
App 自己的权限——你的 App 永远不会触碰用户所选目标的网络、通讯录或存储
权限。

`libshare` 自己的 `AndroidManifest.xml` 中会自动添加两个 `<provider>`
声明（由 Gradle 的 manifest 合并器合并进最终的 App manifest，无需手动
编辑）：

| Provider | Authority | 用途 |
| --- | --- | --- |
| `com.cocos.share.ShareFileProvider` | `${applicationId}.sharefileprovider` | 一个 [`FileProvider`](https://developer.android.com/reference/androidx/core/content/FileProvider)，把你传给 `shareFile`/`shareImage` 的绝对文件路径转换为 `content://` URI，因此扩展从不需要 `MANAGE_EXTERNAL_STORAGE`、旧版 `WRITE_EXTERNAL_STORAGE`，也不需要跨 App 分享时会被现代 Android 拦截（`FileUriExposedException`）的 `file://` URI。 |
| `com.cocos.share.ShareInitProvider` | `${applicationId}.shareinit` | 一个空操作的 `ContentProvider`，唯一作用是让它的 `onCreate()` 在 `Application.onCreate()` 之前运行——这是无需改动 `Application`/`MainActivity` 就能拿到的最早可靠钩子，用来注册原生 `"share"` 桥接监听器。 |

两个 provider 都声明了 `exported="false"`；`ShareFileProvider` 还声明了
`grantUriPermissions="true"`，让接收方 App 获得对那一个 URI 的临时读取
权限，仅此而已，不多不少。

`share_file_provider_paths.xml` 暴露了整个 App files 根目录和 cache 根
目录（`<files-path path="/" name="filesRoot"/>` 和
`<cache-path path="/" name="cacheRoot"/>`），所以任何写在
`native.fileUtils.getWritablePath()` 或 App 缓存目录下的文件都可以直接
分享，无需额外配置。

## 完成状态判定机制详解

这是[主文档](../index.md#分享结果的可靠性请在依赖它做判断之前阅读本节)
中平台说明在 Android 上的具体实现细节。`Intent` 系统没有任何直接信号
能告诉你 "分享是否真的发生了"，因此 `ShareServiceHub` 结合了两个独立
信号，谁先触发就采信谁：

1. **选定组件广播（最理想的情况）。** 选择器是通过
   `Intent.createChooser(intent, title, chosenComponentIntentSender)`
   构建的，其中 `chosenComponentIntentSender` 包装了一个在
   `startActivity` 之前注册的一次性 `BroadcastReceiver`。如果系统成功
   投递了这个广播，`ShareServiceHub` 就能读到用户实际选择的
   `ComponentName`，并上报 `'completed'`，`activityType` 为该组件的
   扁平化短字符串（例如 `"com.whatsapp/.ShareActivity"`）。在 API 34+
   上，这个 receiver 会以 `RECEIVER_NOT_EXPORTED` 注册，因为它只需要
   接收系统自己的广播。在 API 31（`S`）及以上，包裹用的 `PendingIntent`
   需要 `FLAG_MUTABLE`——系统会在投递前重写 intent 的 extras，如果
   `PendingIntent` 是不可变的，将无法收到组件名。
2. **Activity 恢复兜底方案。** 并非所有 App、所有厂商定制系统都能可靠
   触发上面的广播。作为安全网，`ShareServiceHub` 还注册了一个
   `Application.ActivityLifecycleCallbacks`，监测游戏所在 Activity 何时
   下一次恢复前台：
   - 在选择器启动后的 `customThresholdMs`（默认 `1000`）**之内**恢复 →
     判定为 `'canceled'`（用户很可能在选定任何目标之前就退出了选择器），
     `activityType: null`。
   - 在这个时间窗口**之后**恢复，且广播尚未给出答案 → 判定为
     `'completed'`，`activityType: "UnknownActivity"`——扩展知道用户很
     可能进行了某种交互，只是不清楚具体是什么。

   两个信号谁先响应就采信谁；一旦已经给出过结果，另一个信号会被忽略
   （由同一个 `_pending` 标志位保护，这个标志位也是
   `E_SHARE_IN_PROGRESS` 的判定依据）。

如果你的目标 App 普遍启动较慢，可以调高 `customThresholdMs`（例如在
低端设备上冷启动一个较重的社交类 App 可能超过 1 秒，否则可能会把一次
真实的分享误判为 `'canceled'`）。

## 构建配置

- **模块**：`proj/libshare`，Gradle `namespace 'com.cocos.share'`。
- **minSdkVersion / targetSdkVersion / compileSdkVersion**：继承自项目
  全局 Android 构建属性（`PROP_MIN_SDK_VERSION` 等）——扩展本身不会
  硬编码或抬高你的下限。
- **依赖**：`implementation project(':libcocos')`（引擎自身模块）以及
  `implementation 'androidx.core:core:1.13.1'`（Apache 2.0 协议，构建
  时从 Google Maven 仓库解析，详见
  [`THIRD_PARTY_NOTICES.md`](../../../../../THIRD_PARTY_NOTICES.md)；
  未提交到本仓库中）。
- **文件附件路径**：请传入来自
  `native.fileUtils.getWritablePath()`（或你自己的缓存目录）的原始绝对
  路径，不要带 `file://` 前缀——详见
  [主 API 参考](../index.md#sharesharefileoptions-sharefileoptions-promiseshareresult)
  中 `shareFile` 相关说明。带 `file://` 前缀的路径会在 Android 的
  `new File(filePath)` 存在性检查中失败，并以 `E_SHARE_FAILED` 拒绝。

## 已知限制

- Android 上的 `'completed'` 是一种尽力而为的分类判断，不是送达保证
  ——详见[分享结果的可靠性](../index.md#分享结果的可靠性请在依赖它做判断之前阅读本节)。
- 同一时间只能有一个分享面板处于打开状态；已有一次调用未结束时再次
  调用会立即以 `E_SHARE_IN_PROGRESS` 拒绝。
- 本扩展不会弹出任何运行时权限请求——如果这让你意外，原因是根本不需要
  （详见上文"权限"部分）。
- `title` 用于设置 Android 选择器的标题栏；除了 `Intent.createChooser`
  自身支持的能力之外，没有其他方式可以隐藏或改变它的样式。
