/*
 Share — Native share sheet extension for Cocos Creator 3.8.8
 Port of godot-share: UIActivityViewController (iOS) / Intent chooser (Android)

 MIT License
*/

import { IBuildResult } from '../@types';
import { PACKAGE_NAME } from './builder';
import { ShareOption } from './ShareOptions';
import * as fse from 'fs-extra';
import { ITaskOptions } from './hooks';

const TAG = '[BuildTaskiOS]';

/**
 * @en
 * Handles all iOS post-build tasks for the Share extension.
 *
 * Responsibilities:
 *  - Copy Pre-share.cmake / Post-share.cmake into native/engine/ios so Cocos'
 *    CMake include chain picks them up.
 *  - Copy the share bridge directory into the built Xcode project's proj/share
 *    folder so the CMake integration can reference it.
 *  - Honour the `enableShare` flag: when false, remove the cmake files from
 *    native/engine/ios instead of copying them.
 */
export class BuildTaskiOS {

    /** Absolute path to the extension's iOS template directory. */
    static readonly ShareTemplatePath = `${__dirname}/../template/ios`;

    /** Absolute path to the engine's native iOS directory (shared across builds). */
    static readonly NativePath = `${Editor.Project.path}/native/engine/ios`;

    /**
     * @en
     * Copy Pre-share.cmake and Post-share.cmake into native/engine/ios,
     * and copy the share bridge directory into the built Xcode project.
     *
     * @param option       Typed build-task options from the build panel.
     * @param buildResult  Build result carrying the destination path.
     */
    copyShareResources(option: ITaskOptions, buildResult: IBuildResult): void {
        console.log(TAG, 'copyShareResources', 'start');

        const shareOption = option.packages[PACKAGE_NAME] as ShareOption;
        const overwrite = shareOption.overwriteLibrary;

        // --- CMake integration files → native/engine/ios ---
        const preCmakeSrc  = `${BuildTaskiOS.ShareTemplatePath}/Pre-share.cmake`;
        const postCmakeSrc = `${BuildTaskiOS.ShareTemplatePath}/Post-share.cmake`;
        const preCmakeDest  = `${BuildTaskiOS.NativePath}/Pre-share.cmake`;
        const postCmakeDest = `${BuildTaskiOS.NativePath}/Post-share.cmake`;

        fse.copySync(preCmakeSrc,  preCmakeDest,  { overwrite });
        fse.copySync(postCmakeSrc, postCmakeDest, { overwrite });

        // --- share bridge directory → <buildDest>/proj/share ---
        const shareSrc  = `${BuildTaskiOS.ShareTemplatePath}/share`;
        const shareDest = `${buildResult.dest}/proj/share`;
        fse.copySync(shareSrc, shareDest, { recursive: true, overwrite });

        console.log(TAG, 'copyShareResources', 'end');
    }

    /**
     * @en
     * Remove the CMake integration files from native/engine/ios.
     *
     * Called when enableShare is false so that a previously-enabled build does
     * not leave stale cmake includes in the shared native directory.
     */
    removeShareCmakeFiles(): void {
        console.log(TAG, 'removeShareCmakeFiles', 'start');

        const preCmakeDest  = `${BuildTaskiOS.NativePath}/Pre-share.cmake`;
        const postCmakeDest = `${BuildTaskiOS.NativePath}/Post-share.cmake`;

        fse.removeSync(preCmakeDest);
        fse.removeSync(postCmakeDest);

        console.log(TAG, 'removeShareCmakeFiles', 'end');
    }

    /**
     * @en
     * Entry point called by the build hook for iOS post-build tasks.
     *
     * @param options      Typed build-task options from the build panel.
     * @param buildResult  Build result carrying the destination path.
     */
    executePostBuildTasks(options: ITaskOptions, buildResult: IBuildResult): void {
        console.log(TAG, 'executePostBuildTasks', 'start');

        const shareOption = options.packages[PACKAGE_NAME] as ShareOption;
        const enableShare = shareOption.enableShare;

        if (enableShare) {
            this.copyShareResources(options, buildResult);
        } else {
            console.log(TAG, 'executePostBuildTasks', 'enableShare is false — removing cmake files');
            this.removeShareCmakeFiles();
        }

        console.log(TAG, 'executePostBuildTasks', 'all tasks done.');
    }
}

/**
 * @en
 * The global instance of the iOS build task.
 * Exported as `buildTaskiOS.ios` to match the shape hooks.ts expects.
 */
export const buildTaskiOS = {
    ios: new BuildTaskiOS(),
};
