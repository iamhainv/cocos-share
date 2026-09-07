/*
 Share — Native share sheet extension for Cocos Creator 3.8.8
 Port of godot-share: UIActivityViewController (iOS) / Intent chooser (Android)

 MIT License
*/

/**
 * @en
 * ShareOption holds the build-panel configurations for the Share extension.
 * After the build process completes the custom options are passed via
 * `onAfterBuild` / `onAfterCompressSettings` in `hooks.ts`.
 * Fetch them with `options.packages[PACKAGE_NAME]`.
 */
export interface ShareOption {
    /**
     * @en
     * Enable or disable the Share extension.
     * When true, native library files are copied and Gradle/CMake snippets are
     * injected into the built project.  When false, all injected content is
     * cleanly removed.
     */
    enableShare?: boolean;

    /**
     * @en
     * Force-overwrite the native library directory in the built project on every
     * build, even when it already exists.  Disable to preserve manual edits.
     */
    overwriteLibrary?: boolean;
}
