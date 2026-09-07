module.exports = {
    title: 'Share — 原生分享扩展',
    description: 'Share — 原生分享面板（UIActivityViewController / Android Intent 选择器）',

    enableShare: {
        title: '启用 Share',
        tip: '启用或禁用 Share 模块。启用后，CMake 集成文件将复制到 native/engine/ios，share 桥接目录将复制到构建项目中。',
    },

    overwriteLibrary: {
        title: '强制覆盖 Share 库文件',
        tip: '强制将扩展模板中的文件覆盖到构建输出的 proj/share 目录。',
    },
};
