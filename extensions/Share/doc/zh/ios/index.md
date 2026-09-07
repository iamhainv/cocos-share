# Cocos Share — iOS（中文）

## 扩展为你做了什么

当 iOS 标签页的 **启用 Share** 开启时，构建钩子会：

1. 把 `template/ios/share`（`ShareServiceHub.h`/`.mm` ObjC 静态库及其
   `share.cmake`）拷贝进构建产物的 `proj/share` 目录。
2. 把 `Pre-share.cmake`（有意留空的空操作文件，仅为了让拷贝逻辑与其他
   扩展的 pre/post 钩子对保持一致）和 `Post-share.cmake`（存在时
   `include` `proj/share/share.cmake`）拷贝进 `native/engine/ios/`。
3. `share.cmake` 会链接 `UIKit.framework`（Cocos 引擎自身已经链接过，
   这里是防御性而非新增行为），并通过 `-ObjC` 标志把静态库强制加载进
   最终可执行文件，每个文件都强制启用 ARC——不涉及 Swift 运行时，也不
   涉及 `.xcframework`。

**不需要手动编辑 `AppDelegate.mm`。** Cocos 基础模板的 `AppDelegate.mm`
中已经包含：

```objc
#if __has_include("ShareServiceHub.h")
#import "ShareServiceHub.h"
#endif
```

以及在 `application:didFinishLaunchingWithOptions:` 中对应的、同样受
保护的 `[[ShareServiceHub sharedInstance] initShareService]` 调用。这个
`#if __has_include` 判断在头文件不存在时（Share 未启用或未安装）是
空操作，一旦上面的构建钩子把头文件拷贝进来就会自动生效——这与这个系列
里其他原生扩展（Deeplink、IAP、Firebase、AdMob、In-App Review、
Notification Scheduler）使用的是同一套模式。如果你在审查生成出来的
Xcode 工程，这就是需要查看的地方；正常情况下你不需要在这里添加或修改
任何内容。

关闭 **启用 Share** 会在下一次构建时移除已拷贝的 CMake 集成文件，使
`#if __has_include` 判断回落到空操作分支。**强制覆盖 Share 库文件**
（默认开启）决定重新构建时是否会覆盖已构建产物中 `proj/share` 里可能
被你手动改过的文件——只有在你确实想手动修补构建产物时才需要关闭它。

## 权限 / 能力

本扩展不需要任何 `Info.plist` key、entitlement 或能力开关。
`UIActivityViewController` 会在目标 App 自己的进程中运行其自身的
扩展——例如某个目标活动如果需要访问相册或通讯录，这是由*那个活动*自己
协商的，而不是你的 App，因此你的 App 的 `Info.plist` 中不需要为 Share
声明任何内容。

有一点值得特别留意：在 iPad 上，`UIActivityViewController` **必须**
从一个带有具体 `sourceView`/`sourceRect` 的
`UIPopoverPresentationController` 呈现出来，否则 `UIKit` 会在展示时
抛出异常。`ShareServiceHub` 已经自动为你处理好了这一点（锚定到最上层
视图控制器的 view 上），因此你不需要从游戏代码中传入任何锚点信息——
只需要知道，这也是原生实现为什么需要一个真实的、屏幕上可见的视图
控制器才能展示分享面板的原因，也是下文 `E_SHARE_FAILED` 情形的来源
之一。

## 完成状态反馈详解

这是[主文档](../index.md#分享结果的可靠性请在依赖它做判断之前阅读本节)
中平台说明在 iOS 上的另一半内容。与 Android 不同，
`UIActivityViewController` 提供了真正的完成回调：

```objc
controller.completionWithItemsHandler = ^(UIActivityType activityType,
                                           BOOL completed,
                                           NSArray *returnedItems,
                                           NSError *activityError) {
    // completed == YES  -> 'completed'，activityType 为真实的活动标识
    // completed == NO   -> 'canceled'， activityType: null
    // activityError 有值 -> E_SHARE_FAILED
};
```

对于苹果自带的活动（邮件、信息、"复制"、"存储图像"、AirDrop 等），这个
回调是准确的：`completed` 真实反映了用户是否完成了该操作。需要留意的
是**第三方分享扩展**（用户安装的、注册了 `UIActivityViewController`
扩展的 App，例如许多社交和聊天类 App）：iOS 并不强制要求它们准确上报
`completed`/`activityType`，因此偶尔会出现用户明明已经在那个 App 中
完成分享、却仍然收到 `completed = NO` 的情况，或者 `activityType` 在
`'completed'` 结果上仍然是 `null`。Cocos Share 这一侧没有任何办法绕开
这个问题——这是你的 App 与第三方扩展之间平台层面的信任边界。

`excludedActivityTypes` 预设为 `[Print, AssignToContact,
AddToReadingList, MarkupAsPDF]`——这些对于本扩展主打的轻量文本/文件/
图片分享场景大多没有意义，隐藏它们能让面板显得更简洁。目前没有构建
面板选项或运行时选项可以修改这份列表；如果你需要不同的配置，请直接
编辑 `ShareServiceHub.mm` 并重新构建。

## 构建配置

- **Target**：`proj/share`，纯 Objective-C 静态库（`share.cmake` 中的
  `add_library`），每个文件都强制启用 ARC。
- **部署目标**：iOS 13.0+（与本扩展声明的兼容性一致；不会在你项目原本
  设定的基础上再单独抬高）。
- **依赖**：仅 `UIKit.framework`——不涉及 Swift 运行时、
  `.xcframework`，也不涉及 CocoaPods/SPM 包。详见
  [`THIRD_PARTY_NOTICES.md`](../../../../../THIRD_PARTY_NOTICES.md)。
- **`filePath` 处理**：`ShareServiceHub.mm` 会防御性地去掉 `filePath`
  开头可能存在的 `file://` 前缀，再解析出文件 URL。这比 Android（不会
  去掉该前缀，会直接失败）更宽容——但不要依赖这一点，为了跨平台行为
  一致，请始终传入原始绝对路径，参见
  [主 API 参考](../index.md#sharesharefileoptions-sharefileoptions-promiseshareresult)。
- **`title`**：会从调用参数中解析出来，但在 iOS 上不会用于任何地方
  ——`UIActivityViewController` 没有选择器标题这个概念；它只影响
  Android 选择器的标题栏。
- **`customThresholdMs`**：为了 API 对称性而被接受，但会被静默忽略
  ——iOS 始终使用真实的 `completionWithItemsHandler`，不需要这套
  基于 Activity 生命周期的启发式判断。

## 已知限制

- 第三方分享扩展可能上报不准确的 `completed`/`activityType` 值——详见
  上文[完成状态反馈详解](#完成状态反馈详解)。苹果自带的活动是可靠的，
  其他一切都只是尽力而为。
- 同一时间只能有一个分享面板处于打开状态；已有一次调用未结束时再次
  调用会立即以 `E_SHARE_IN_PROGRESS` 拒绝。
- 展示分享面板需要一个真实的、屏幕上可见的根/已展示视图控制器；如果
  在 App 还没有可见窗口时就调用分享 API（例如启动流程非常早期），可能
  会以 `E_SHARE_FAILED` 失败。
- 没有 `Info.plist` 能力声明可以用来在
  `ShareServiceHub.mm` 中固定写死的 `excludedActivityTypes` 列表之外
  再单独排除某些内置活动类型。
