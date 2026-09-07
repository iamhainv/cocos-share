package com.cocos.share;

import android.content.ContentProvider;
import android.content.ContentValues;
import android.database.Cursor;
import android.net.Uri;

/**
 * Zero-content {@link ContentProvider} whose sole purpose is to call
 * {@link ShareBridge#register(android.content.Context)} during app
 * initialisation — before {@code Application.onCreate()} runs and
 * therefore before the first JS frame is executed.
 *
 * <p>This is the standard Cocos extension init pattern (mirrors
 * {@code IapInitProvider} in OpenIAP).</p>
 */
public class ShareInitProvider extends ContentProvider {

    @Override
    public boolean onCreate() {
        ShareBridge.register(getContext());
        return true;
    }

    // -------------------------------------------------------------------------
    // Stub ContentProvider methods — never called.
    // -------------------------------------------------------------------------

    @Override
    public Cursor query(Uri uri, String[] projection, String selection,
            String[] selectionArgs, String sortOrder) {
        return null;
    }

    @Override
    public String getType(Uri uri) {
        return null;
    }

    @Override
    public Uri insert(Uri uri, ContentValues values) {
        return null;
    }

    @Override
    public int delete(Uri uri, String selection, String[] selectionArgs) {
        return 0;
    }

    @Override
    public int update(Uri uri, ContentValues values, String selection,
            String[] selectionArgs) {
        return 0;
    }
}
