/*
 Share — Native share sheet extension for Cocos Creator 3.8.8
 Port of godot-share: UIActivityViewController (iOS) / Intent chooser (Android)

 MIT License
*/
import { BuildPlugin } from '../@types';

/** @en Called when the extension is loaded by the editor. */
export const load: BuildPlugin.load = function () {
    console.debug(`${PACKAGE_NAME} load`);
};

/** @en Called when the extension is unloaded by the editor. */
export const unload: BuildPlugin.load = function () {
    console.debug(`${PACKAGE_NAME} unload`);
};

/** @en The package name that identifies this extension across the build pipeline. */
export const PACKAGE_NAME = 'share';

/**
 * @en
 * Build plugin configurations for Android and iOS platforms.
 * Each platform declares the hook entry-point and the options shown in the
 * build panel.
 */
export const configs: BuildPlugin.Configs = {
    'android': {
        hooks: './hooks',
        doc: 'editor/publish/custom-build-plugin.html',
        options: {
            enableShare: {
                label: `i18n:${PACKAGE_NAME}.enableShare.title`,
                description: `i18n:${PACKAGE_NAME}.enableShare.tip`,
                default: `true`,
                render: {
                    ui: 'ui-checkbox',
                },
            },
            overwriteLibrary: {
                label: `i18n:${PACKAGE_NAME}.overwriteLibrary.title`,
                description: `i18n:${PACKAGE_NAME}.overwriteLibrary.tip`,
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
                label: `i18n:${PACKAGE_NAME}.enableShare.title`,
                description: `i18n:${PACKAGE_NAME}.enableShare.tip`,
                default: `true`,
                render: {
                    ui: 'ui-checkbox',
                },
            },
            overwriteLibrary: {
                label: `i18n:${PACKAGE_NAME}.overwriteLibrary.title`,
                description: `i18n:${PACKAGE_NAME}.overwriteLibrary.tip`,
                default: `true`,
                render: {
                    ui: 'ui-checkbox',
                },
            },
        },
    },
};

/** @en Asset-handler entry-point for the Cocos build pipeline. */
export const assetHandlers: BuildPlugin.AssetHandlers = './asset-handlers';
