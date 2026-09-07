"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.assetHandlers = exports.configs = exports.PACKAGE_NAME = exports.unload = exports.load = void 0;
/** @en Called when the extension is loaded by the editor. */
const load = function () {
    console.debug(`${exports.PACKAGE_NAME} load`);
};
exports.load = load;
/** @en Called when the extension is unloaded by the editor. */
const unload = function () {
    console.debug(`${exports.PACKAGE_NAME} unload`);
};
exports.unload = unload;
/** @en The package name that identifies this extension across the build pipeline. */
exports.PACKAGE_NAME = 'share';
/**
 * @en
 * Build plugin configurations for Android and iOS platforms.
 * Each platform declares the hook entry-point and the options shown in the
 * build panel.
 */
exports.configs = {
    'android': {
        hooks: './hooks',
        doc: 'editor/publish/custom-build-plugin.html',
        options: {
            enableShare: {
                label: `i18n:${exports.PACKAGE_NAME}.enableShare.title`,
                description: `i18n:${exports.PACKAGE_NAME}.enableShare.tip`,
                default: `true`,
                render: {
                    ui: 'ui-checkbox',
                },
            },
            overwriteLibrary: {
                label: `i18n:${exports.PACKAGE_NAME}.overwriteLibrary.title`,
                description: `i18n:${exports.PACKAGE_NAME}.overwriteLibrary.tip`,
                default: `true`,
                render: {
                    ui: 'ui-checkbox',
                },
            },
        },
    },
    'ios': {
        hooks: './hooks',
        doc: 'editor/publish/custom-build-plugin.html',
        options: {
            enableShare: {
                label: `i18n:${exports.PACKAGE_NAME}.enableShare.title`,
                description: `i18n:${exports.PACKAGE_NAME}.enableShare.tip`,
                default: `true`,
                render: {
                    ui: 'ui-checkbox',
                },
            },
            overwriteLibrary: {
                label: `i18n:${exports.PACKAGE_NAME}.overwriteLibrary.title`,
                description: `i18n:${exports.PACKAGE_NAME}.overwriteLibrary.tip`,
                default: `true`,
                render: {
                    ui: 'ui-checkbox',
                },
            },
        },
    },
};
/** @en Asset-handler entry-point for the Cocos build pipeline. */
exports.assetHandlers = './asset-handlers';
