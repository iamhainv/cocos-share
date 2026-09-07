module.exports = {
    title: 'Share — Native Share Sheet Extension',
    description: 'Share — Native share sheet (UIActivityViewController / Android Intent chooser)',

    enableShare: {
        title: 'Enable Share',
        tip: 'Enable or disable the Share module. When enabled, CMake integration files are copied into native/engine/ios and the share bridge directory is copied into the built project.',
    },

    overwriteLibrary: {
        title: 'Force overwrite the Share library',
        tip: 'Force overwrite the files in the built proj/share from the extension\'s template.',
    },
};
