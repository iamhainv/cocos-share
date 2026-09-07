/*
 Share — Native share sheet extension for Cocos Creator 3.8.8
 Port of godot-share: UIActivityViewController (iOS) / Intent chooser (Android)

 MIT License
*/
import { AssetHandlers } from '../@types';
import { outputFile } from 'fs-extra';

/**
 * @en
 * Texture compression handler for the Share extension.
 *
 * Share does not introduce any custom textures, so this handler is a no-op for
 * all compression tasks.  It exists because `builder.ts` declares
 * `assetHandlers: './asset-handlers'` and the Cocos build pipeline requires
 * the referenced module to export a `compressTextures` function.
 */
export const compressTextures: AssetHandlers.compressTextures = async (tasks) => {
    console.debug(`[Share] asset-handlers: compressTextures called with ${tasks.length} task(s)`);
    for (let i = 0; i < tasks.length; i++) {
        const task = tasks[i];
        if (task.format !== 'jpg') {
            continue;
        }
        // Rewrite extension before compress so the output has the correct name.
        task.dest = task.dest.replace('.png', '.jpg');
        await _pngToJpg(task.src, task.dest, task.quality as number);
        tasks.splice(i, 1);
        i--;
    }
};

async function _pngToJpg(src: string, dest: string, quality: number): Promise<void> {
    const img = await _loadImage(src) as CanvasImageSource;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);
    const imageData = canvas.toDataURL('image/jpeg', quality / 100);
    await outputFile(dest, imageData);
    console.debug('[Share] asset-handlers: pngToJpg', dest);
}

function _loadImage(path: string): Promise<unknown> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = (err) => reject(err);
        img.src = path.replace('#', '%23');
    });
}
