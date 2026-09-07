/**
 * Share extension — public types and constants.
 *
 * Import from the barrel:
 *   import { ShareResult, MIME_TYPE_IMAGE, ... } from 'db://share/index';
 */

// ---------------------------------------------------------------------------
// Result types
// ---------------------------------------------------------------------------

/**
 * Outcome of a share operation.
 *
 * - `'completed'` — iOS: the user successfully shared via the chosen activity.
 *   Android: the user picked a target or returned to the app after the
 *   lifecycle-threshold delay. Android **cannot** guarantee true delivery, so
 *   treat `'completed'` on Android as "user engaged with a target or at least
 *   did not dismiss immediately".
 * - `'canceled'` — The user dismissed the sheet without choosing a target, or
 *   on Android the app returned to the foreground within the threshold window.
 */
export type ShareResultStatus = 'completed' | 'canceled';

/** Successful result returned by a share call. */
export interface ShareResult {
    /** The final outcome of the share sheet interaction. */
    result: ShareResultStatus;
    /**
     * Platform activity identifier of the chosen sharing target, or `null`
     * when the platform does not expose it.
     *
     * Examples:
     *   iOS   — `"com.apple.UIKit.activity.Mail"`, `"com.apple.UIKit.activity.CopyToPasteboard"`
     *   Android — component name string, e.g. `"com.whatsapp/.ShareActivity"`
     */
    activityType: string | null;
}

/** Error object rejected by a share call. */
export interface ShareError {
    /**
     * Machine-readable error code.
     *
     * Built-in codes:
     *   `E_NOT_SUPPORTED`    — called on a non-native platform (web/editor)
     *   `E_TIMEOUT`          — no response within the configured timeout window
     *   `E_SHARE_IN_PROGRESS`— a share sheet is already open; concurrent shares
     *                          are not supported
     *   `E_INVALID_ARGS`     — required arguments are missing or malformed
     *   Any platform-specific code returned by the native layer.
     */
    code: string;
    /** Human-readable description of the error. */
    message: string;
}

// ---------------------------------------------------------------------------
// Options types
// ---------------------------------------------------------------------------

/** Options for sharing plain text content. */
export interface ShareTextOptions {
    /** Dialog / chooser title shown on Android. Ignored on iOS. */
    title?: string;
    /** Email subject line (used when the user picks a mail app). */
    subject?: string;
    /** The text body to share. Required for `shareText`. */
    content: string;
    /**
     * Android only. Milliseconds used to differentiate a cancellation from a
     * completion via the activity-lifecycle heuristic. When the app returns to
     * the foreground within this window the share is treated as `'canceled'`;
     * after it, `'completed'`. Defaults to 1000 ms on the native side.
     */
    customThresholdMs?: number;
}

/**
 * Options for sharing a file (image, PDF, etc.).
 *
 * `filePath` must be an absolute native filesystem path, e.g. one obtained
 * from `native.fileUtils.getWritablePath()` or a cached download location.
 * Relative paths and `file://` URIs are not accepted — pass the raw absolute
 * path (e.g. `/data/user/0/com.myapp/cache/image.png` on Android,
 * `/var/mobile/Containers/Data/.../tmp/image.png` on iOS).
 */
export interface ShareFileOptions extends Omit<ShareTextOptions, 'content'> {
    /** Optional text body to accompany the file. */
    content?: string;
    /**
     * Absolute native filesystem path to the file to share.
     * See interface doc comment for requirements.
     */
    filePath: string;
    /**
     * MIME type of the file (e.g. `'image/png'`, `'application/pdf'`).
     * Use the `MIME_TYPE_*` constants for common values.
     */
    mimeType: string;
}

// ---------------------------------------------------------------------------
// MIME type constants
// ---------------------------------------------------------------------------

/** MIME type constant for plain text content. */
export const MIME_TYPE_TEXT = 'text/plain' as const;

/** MIME type constant for any image format. */
export const MIME_TYPE_IMAGE = 'image/*' as const;
