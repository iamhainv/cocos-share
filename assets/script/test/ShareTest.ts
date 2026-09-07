/**
 * ShareTest — runtime demo for the Cocos Share extension.
 *
 * Builds its whole UI in code (no scene-baked buttons) so the example is
 * fully readable in a single file. Attach this component to any Node in a
 * scene with a UI camera (see assets/scene/main.scene) and it will lay out
 * three buttons:
 *
 *   - Share Text  — share.shareText()
 *   - Share Image — writes a small embedded PNG to the writable path, then
 *                   share.shareImage()
 *   - Share File  — writes a small .txt file to the writable path, then
 *                   share.shareFile()
 *
 * On web preview / editor (non-native), the extension's bridge already
 * rejects every call with { code: 'E_NOT_SUPPORTED' } — this component just
 * catches that and shows a friendly status message instead of crashing.
 */

import { _decorator, Component, Node, Label, Graphics, Color, UITransform, Vec3, native, sys } from 'cc';
import { share } from 'db://share/index';
import type { ShareError, ShareResult } from 'db://share/index';

const { ccclass } = _decorator;

const TAG = '[ShareTest]';

// ---------------------------------------------------------------------------
// A tiny (64x64, solid color) embedded PNG used for the "Share Image" demo,
// so the example does not depend on any bundled image asset. Generated
// offline and verified to be a valid, CRC-correct PNG.
// ---------------------------------------------------------------------------
const DEMO_PNG_BASE64 =
    'iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAIAAAAlC+aJAAAATUlEQVR42u3PQQkAAAgEsOtrAttfBN/CYAWW7PwmICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHAppbtA02P6n0kAAAAASUVORK5CYII=';

const DEMO_TEXT_CONTENT =
    'Hello from the Cocos Share demo!\n\nThis file was written at runtime and shared via the Share extension.';

function base64ToUint8Array(b64: string): Uint8Array {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
    const clean = b64.replace(/=+$/, '');
    const bytes: number[] = [];
    let buffer = 0;
    let bits = 0;
    for (let i = 0; i < clean.length; i++) {
        const c = chars.indexOf(clean.charAt(i));
        if (c === -1) { continue; }
        buffer = (buffer << 6) | c;
        bits += 6;
        if (bits >= 8) {
            bits -= 8;
            bytes.push((buffer >> bits) & 0xff);
        }
    }
    return new Uint8Array(bytes);
}

@ccclass('ShareTest')
export class ShareTest extends Component {

    private _statusLabel: Label | null = null;

    onLoad() {
        this._buildUI();
    }

    // -----------------------------------------------------------------
    // UI construction (no scene-baked prefabs — everything built in code)
    // -----------------------------------------------------------------

    private _buildUI(): void {
        const root = this.node;
        const rootUi = root.getComponent(UITransform) ?? root.addComponent(UITransform);
        rootUi.setContentSize(640, 720);

        this._addLabel(root, 'Cocos Share Demo', 0, 260, 28, true);

        this._statusLabel = this._addLabel(
            root,
            sys.isNative
                ? 'Tap a button to test native sharing.'
                : 'Web/editor preview — native sharing is disabled here.\nBuild to Android/iOS to test.',
            0, 170, 20, false,
        );

        this._addButton(root, 'Share Text', 90, () => this._onShareText());
        this._addButton(root, 'Share Image', 0, () => this._onShareImage());
        this._addButton(root, 'Share File', -90, () => this._onShareFile());
    }

    private _addLabel(parent: Node, text: string, x: number, y: number, fontSize: number, bold: boolean): Label {
        const node = new Node('Label');
        parent.addChild(node);
        node.setPosition(new Vec3(x, y, 0));
        const ui = node.addComponent(UITransform);
        ui.setContentSize(600, 80);
        const label = node.addComponent(Label);
        label.string = text;
        label.fontSize = fontSize;
        label.lineHeight = fontSize + 6;
        label.isBold = bold;
        label.horizontalAlign = Label.HorizontalAlign.CENTER;
        label.verticalAlign = Label.VerticalAlign.CENTER;
        label.overflow = Label.Overflow.RESIZE_HEIGHT;
        label.color = new Color(255, 255, 255, 255);
        return label;
    }

    private _addButton(parent: Node, text: string, y: number, onClick: () => void): Node {
        const node = new Node(`Button_${text.replace(/\s+/g, '')}`);
        parent.addChild(node);
        node.setPosition(new Vec3(0, y, 0));

        const ui = node.addComponent(UITransform);
        ui.setContentSize(320, 64);

        const graphics = node.addComponent(Graphics);
        graphics.fillColor = new Color(43, 108, 176, 255);
        graphics.roundRect(-160, -32, 320, 64, 12);
        graphics.fill();

        const labelNode = new Node('Label');
        node.addChild(labelNode);
        const labelUi = labelNode.addComponent(UITransform);
        labelUi.setContentSize(320, 64);
        const label = labelNode.addComponent(Label);
        label.string = text;
        label.fontSize = 22;
        label.horizontalAlign = Label.HorizontalAlign.CENTER;
        label.verticalAlign = Label.VerticalAlign.CENTER;
        label.color = new Color(255, 255, 255, 255);

        node.on(Node.EventType.TOUCH_END, () => onClick(), this);

        return node;
    }

    private _setStatus(text: string): void {
        if (this._statusLabel) {
            this._statusLabel.string = text;
        }
        console.log(TAG, text);
    }

    // -----------------------------------------------------------------
    // Button handlers
    // -----------------------------------------------------------------

    private async _onShareText(): Promise<void> {
        this._setStatus('Opening share sheet (text)...');
        try {
            const result: ShareResult = await share.shareText({
                title: 'Cocos Share Demo',
                content: 'Hello from the Cocos Share demo! https://github.com/',
            });
            this._setStatus(`Text share ${result.result}. activityType=${result.activityType ?? 'n/a'}`);
        } catch (e) {
            this._reportError('Text share', e as ShareError);
        }
    }

    private async _onShareFile(): Promise<void> {
        this._setStatus('Writing demo file...');
        try {
            const path = this._writableFilePath('share-demo.txt');
            const ok = (native.fileUtils as any).writeStringToFile(DEMO_TEXT_CONTENT, path);
            if (!ok) {
                throw { code: 'E_LOCAL_WRITE_FAILED', message: `Failed to write ${path}` } as ShareError;
            }
            this._setStatus('Opening share sheet (file)...');
            const result: ShareResult = await share.shareFile({
                title: 'Cocos Share Demo',
                content: 'A text file shared from the Cocos Share demo.',
                filePath: path,
                mimeType: 'text/plain',
            });
            this._setStatus(`File share ${result.result}. activityType=${result.activityType ?? 'n/a'}`);
        } catch (e) {
            this._reportError('File share', e as ShareError);
        }
    }

    private async _onShareImage(): Promise<void> {
        this._setStatus('Writing demo image...');
        try {
            const path = this._writableFilePath('share-demo.png');
            const bytes = base64ToUint8Array(DEMO_PNG_BASE64);
            const ok = (native.fileUtils as any).writeDataToFile(bytes.buffer, path);
            if (!ok) {
                throw { code: 'E_LOCAL_WRITE_FAILED', message: `Failed to write ${path}` } as ShareError;
            }
            this._setStatus('Opening share sheet (image)...');
            const result: ShareResult = await share.shareImage({
                title: 'Cocos Share Demo',
                filePath: path,
            });
            this._setStatus(`Image share ${result.result}. activityType=${result.activityType ?? 'n/a'}`);
        } catch (e) {
            this._reportError('Image share', e as ShareError);
        }
    }

    private _writableFilePath(fileName: string): string {
        const dir = (native.fileUtils as any).getWritablePath() as string;
        return dir + fileName;
    }

    private _reportError(what: string, err: ShareError): void {
        if (err && err.code === 'E_NOT_SUPPORTED') {
            this._setStatus(`${what}: native only — build to Android/iOS to try this.`);
            return;
        }
        const message = (err && err.message) || String(err);
        const code = (err && err.code) || 'E_UNKNOWN';
        this._setStatus(`${what} failed [${code}]: ${message}`);
    }
}
