/**
 * Share extension — public barrel export.
 *
 * Import via the extension alias:
 *   import { share, ShareResult, MIME_TYPE_IMAGE } from 'db://share/index';
 */

export { share, ShareClient } from './ShareClient';
export type {
    ShareResult,
    ShareResultStatus,
    ShareError,
    ShareTextOptions,
    ShareFileOptions,
} from './Types';
export { MIME_TYPE_TEXT, MIME_TYPE_IMAGE } from './Types';
