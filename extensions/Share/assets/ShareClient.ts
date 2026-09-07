/**
 * Share ShareClient — Cocos Creator 3.8.8
 *
 * Public API for the native share sheet on iOS and Android.
 * All methods are async and delegate to the native side via shareBridge.call()
 * with timeout disabled (0), because the response only arrives after the user
 * closes the sheet — which can be several minutes.
 *
 * IMPORTANT — Android completion heuristic:
 * Android's Intent system does not expose the share outcome. The native layer
 * uses an activity-lifecycle heuristic: if the app returns to the foreground
 * within `customThresholdMs` (default 1000 ms) after the Intent resolves, the
 * share is treated as `'canceled'`; after that window it is `'completed'`.
 * This means `'completed'` on Android means the user picked a target — NOT
 * that the content was delivered. iOS provides true completion feedback for
 * built-in activities; third-party apps may still report `null` activityType.
 *
 * Concurrency: only one share sheet may be open at a time. If a share is
 * already in progress, all subsequent calls reject immediately with
 * { code: 'E_SHARE_IN_PROGRESS' }.
 *
 * Usage:
 *   import { share } from 'db://share/index';
 *   const result = await share.shareText({ content: 'Hello from the game!' });
 *   if (result.result === 'completed') { ... }
 */

import { shareBridge } from './core/Bridge';
import {
    MIME_TYPE_IMAGE,
    ShareError,
    ShareFileOptions,
    ShareResult,
    ShareTextOptions,
} from './Types';

// ---------------------------------------------------------------------------
// Wire args type (matches the single native "share" method)
// ---------------------------------------------------------------------------

interface _ShareArgs {
    title?: string;
    subject?: string;
    content?: string;
    filePath?: string;
    mimeType?: string;
    customThresholdMs?: number;
}

// ---------------------------------------------------------------------------
// ShareClient
// ---------------------------------------------------------------------------

/**
 * Cross-platform native share-sheet client.
 *
 * Obtain the singleton via the exported `share` constant. Do not instantiate
 * directly.
 */
export class ShareClient {

    private _shareInProgress: boolean = false;

    // ------------------------------------------------------------------
    // Public share methods
    // ------------------------------------------------------------------

    /**
     * Open the native share sheet to share plain text.
     *
     * Resolves with a {@link ShareResult} once the user dismisses the sheet.
     * On Android, `'completed'` means the user picked a target; true delivery
     * cannot be confirmed (see class doc comment).
     *
     * @param options  Text content and optional title/subject.
     * @returns A promise resolving to a {@link ShareResult}.
     * @throws {@link ShareError} with code `E_SHARE_IN_PROGRESS` if a sheet is
     *         already open.
     * @throws {@link ShareError} with code `E_NOT_SUPPORTED` on non-native
     *         platforms.
     */
    public shareText(options: ShareTextOptions): Promise<ShareResult> {
        if (this._shareInProgress) {
            return Promise.reject<ShareResult>({
                code: 'E_SHARE_IN_PROGRESS',
                message: 'A share sheet is already open. Wait for it to close before sharing again.',
            } as ShareError);
        }

        const args: _ShareArgs = {
            content: options.content,
        };
        if (options.title !== undefined) { args.title = options.title; }
        if (options.subject !== undefined) { args.subject = options.subject; }
        if (options.customThresholdMs !== undefined) {
            args.customThresholdMs = options.customThresholdMs;
        }

        return this._dispatch(args);
    }

    /**
     * Open the native share sheet to share a file.
     *
     * `filePath` must be an absolute native filesystem path obtained from the
     * native layer (e.g. `native.fileUtils.getWritablePath()` + filename).
     * Relative paths and `file://` URIs are not accepted.
     *
     * On Android, `'completed'` means the user picked a target; true delivery
     * cannot be confirmed (see class doc comment).
     *
     * @param options  File path, MIME type, and optional title/subject/content.
     * @returns A promise resolving to a {@link ShareResult}.
     * @throws {@link ShareError} with code `E_SHARE_IN_PROGRESS` if a sheet is
     *         already open.
     * @throws {@link ShareError} with code `E_NOT_SUPPORTED` on non-native
     *         platforms.
     */
    public shareFile(options: ShareFileOptions): Promise<ShareResult> {
        if (this._shareInProgress) {
            return Promise.reject<ShareResult>({
                code: 'E_SHARE_IN_PROGRESS',
                message: 'A share sheet is already open. Wait for it to close before sharing again.',
            } as ShareError);
        }

        const args: _ShareArgs = {
            filePath: options.filePath,
            mimeType: options.mimeType,
        };
        if (options.title !== undefined) { args.title = options.title; }
        if (options.subject !== undefined) { args.subject = options.subject; }
        if (options.content !== undefined) { args.content = options.content; }
        if (options.customThresholdMs !== undefined) {
            args.customThresholdMs = options.customThresholdMs;
        }

        return this._dispatch(args);
    }

    /**
     * Open the native share sheet to share an image file.
     *
     * Convenience wrapper around {@link shareFile} that automatically sets
     * `mimeType` to `'image/*'`. All image formats supported by the platform
     * are accepted (PNG, JPEG, GIF, HEIC, etc.).
     *
     * `filePath` must be an absolute native filesystem path.
     * See {@link shareFile} for path requirements.
     *
     * On Android, `'completed'` means the user picked a target; true delivery
     * cannot be confirmed (see class doc comment).
     *
     * @param options  File path and optional title/subject/content (no mimeType).
     * @returns A promise resolving to a {@link ShareResult}.
     * @throws {@link ShareError} with code `E_SHARE_IN_PROGRESS` if a sheet is
     *         already open.
     * @throws {@link ShareError} with code `E_NOT_SUPPORTED` on non-native
     *         platforms.
     */
    public shareImage(options: Omit<ShareFileOptions, 'mimeType'>): Promise<ShareResult> {
        return this.shareFile({ ...options, mimeType: MIME_TYPE_IMAGE });
    }

    // ------------------------------------------------------------------
    // Private helpers
    // ------------------------------------------------------------------

    /**
     * Internal dispatcher. Sets the in-progress guard, calls the bridge with
     * timeout disabled, and clears the guard on resolution or rejection.
     */
    private _dispatch(args: _ShareArgs): Promise<ShareResult> {
        this._shareInProgress = true;

        // Timeout is disabled (0) — the response arrives only after the user
        // closes the native share sheet, which may take an arbitrary amount
        // of time.
        return shareBridge.call<ShareResult>('share', args, 0)
            .then((result) => {
                this._shareInProgress = false;
                return result;
            })
            .catch((err: ShareError) => {
                this._shareInProgress = false;
                throw err;
            });
    }
}

/** Singleton share client instance. Import this in your game code. */
export const share = new ShareClient();
