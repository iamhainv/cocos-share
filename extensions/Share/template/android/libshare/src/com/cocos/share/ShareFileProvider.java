package com.cocos.share;

import androidx.core.content.FileProvider;

/**
 * Thin subclass of {@link FileProvider} required because two libraries
 * cannot share the same FileProvider class.  The actual path configuration
 * lives in {@code res/xml/share_file_provider_paths.xml}.
 */
public class ShareFileProvider extends FileProvider {
    // No additional implementation required.
}
