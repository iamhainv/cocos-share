/*
 Share — Native share sheet extension for Cocos Creator 3.8.8
 Port of godot-share: UIActivityViewController (iOS) / Intent chooser (Android)

 MIT License
*/

/**
 * @en
 * Compile-time path constants for the Android build task.
 * All paths are derived from `Editor.Project.path` or `__dirname` at runtime —
 * no hardcoded absolute paths.
 */
export class AndroidConstants {

    /**
     * @en The native android engine path inside the Cocos project. */
    static readonly NativePath = `${Editor.Project.path}/native/engine/android`;

    /**
     * @en The project-level build.gradle that receives the Share dependency snippet. */
    static readonly AppBuildGradle = `${AndroidConstants.NativePath}/app/build.gradle`;

    /**
     * @en The template directory of this extension on disk. */
    static readonly ShareTemplatePath = `${__dirname}/../template/android`;

    /**
     * @en
     * The build.gradle snippet template that is appended to (or removed from)
     * the built project's build.gradle. */
    static readonly ShareTemplateGradlePath = `${AndroidConstants.ShareTemplatePath}/build.gradle`;

    /**
     * @en The name of the Android native library module. */
    static readonly ShareLibName = 'libshare';

    /**
     * @en Source path of the libshare module inside this extension's template. */
    static readonly ShareLibSrcPath = `${AndroidConstants.ShareTemplatePath}/${AndroidConstants.ShareLibName}`;

    /**
     * @en
     * Relative destination path (appended to `buildResult.dest`) where the
     * libshare module is copied inside the built project. */
    static readonly ShareLibDestPath = `/proj/${AndroidConstants.ShareLibName}`;

    /**
     * @en The filename of the settings.gradle used by the Android project. */
    static readonly SettingGradle = 'settings.gradle';

    /**
     * @en
     * The settings.gradle snippet template (adds `include ':libshare'`) stored
     * inside this extension's template directory. */
    static readonly ShareTemplateSettingGradle =
        `${AndroidConstants.ShareTemplatePath}/${AndroidConstants.SettingGradle}`;
}
