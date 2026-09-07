package com.cocos.share;

import android.app.Activity;
import android.app.Application;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.ClipData;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.util.Log;

import androidx.core.content.FileProvider;

import org.json.JSONException;
import org.json.JSONObject;

import java.io.File;

/**
 * Core share logic ported from godot-share's {@code SharePlugin.java}.
 *
 * <p>Responsible for:</p>
 * <ul>
 *   <li>Building an {@link Intent#ACTION_SEND} intent (with optional file attachment)</li>
 *   <li>Launching a chooser and capturing the chosen component via a
 *       one-shot {@link BroadcastReceiver}</li>
 *   <li>Falling back to a lifecycle-based heuristic when the broadcast
 *       never fires (user back-pressed the chooser)</li>
 *   <li>Guarding against concurrent share attempts with
 *       {@code E_SHARE_IN_PROGRESS}</li>
 * </ul>
 *
 * <p>All public entry points are called from {@link ShareBridge} on the
 * Cocos game thread.  {@link #share(int, org.json.JSONObject)} is the only
 * public method beyond {@link #init(Context)}.</p>
 */
public class ShareServiceHub {

    private static final String TAG = "ShareServiceHub";

    /** Default ms to wait after the activity resumes before assuming "canceled". */
    private static final long DEFAULT_THRESHOLD_MS = 1000L;

    // -------------------------------------------------------------------------
    // Pending-share state  (all accesses are on the UI thread)
    // -------------------------------------------------------------------------

    private static volatile boolean _initialized = false;
    private static Context _appContext;

    /** Non-null while a share chooser is open. */
    private static PendingShare _pending = null;

    // -------------------------------------------------------------------------
    // Init
    // -------------------------------------------------------------------------

    /**
     * Initialise the hub.  Must be called once (from
     * {@link ShareBridge#register(Context)}) before any share request arrives.
     *
     * @param context Any context — the application context is retained.
     */
    public static synchronized void init(Context context) {
        if (_initialized) return;
        _appContext = context.getApplicationContext();
        registerLifecycleCallbacks();
        _initialized = true;
        Log.d(TAG, "init() complete");
    }

    // -------------------------------------------------------------------------
    // Public entry point
    // -------------------------------------------------------------------------

    /**
     * Handle a {@code "share"} method call from JS.
     *
     * <p>Expected {@code args} fields (all optional unless noted):</p>
     * <ul>
     *   <li>{@code title}           — chooser title string</li>
     *   <li>{@code subject}         — EXTRA_SUBJECT</li>
     *   <li>{@code content}         — EXTRA_TEXT body</li>
     *   <li>{@code filePath}        — absolute path to a local file to attach</li>
     *   <li>{@code mimeType}        — MIME type, defaults to {@code "text/plain"}</li>
     *   <li>{@code customThresholdMs} — resume-fallback threshold in ms</li>
     * </ul>
     *
     * @param id   JS request id — echoed back in the response.
     * @param args Parsed args from the JS envelope.
     */
    public static void share(final int id, final JSONObject args) {
        final Activity activity = com.cocos.lib.GlobalObject.getActivity();
        if (activity == null) {
            ShareBridge.respondErr(id, "E_SHARE_FAILED", "Activity not available");
            return;
        }

        // Concurrent guard.
        if (_pending != null) {
            ShareBridge.respondErr(id, "E_SHARE_IN_PROGRESS",
                    "A share sheet is already open");
            return;
        }

        final String title = args.optString("title", null);
        final String subject = args.optString("subject", null);
        final String content = args.optString("content", null);
        final String filePath = args.optString("filePath", null);
        final String mimeType = args.optString("mimeType", "text/plain");
        final long thresholdMs = args.optLong("customThresholdMs", DEFAULT_THRESHOLD_MS);

        // Build intent on the game thread; launch on the UI thread.
        final Intent shareIntent = new Intent(Intent.ACTION_SEND);

        if (subject != null && !subject.isEmpty()) {
            shareIntent.putExtra(Intent.EXTRA_SUBJECT, subject);
        }
        if (content != null && !content.isEmpty()) {
            shareIntent.putExtra(Intent.EXTRA_TEXT, content);
        }

        // File attachment.
        if (filePath != null && !filePath.isEmpty()) {
            File file = new File(filePath);
            if (!file.exists()) {
                ShareBridge.respondErr(id, "E_SHARE_FAILED",
                        "File does not exist: " + filePath);
                return;
            }

            Uri uri;
            try {
                uri = FileProvider.getUriForFile(
                        _appContext,
                        _appContext.getPackageName() + ".sharefileprovider",
                        file);
            } catch (IllegalArgumentException e) {
                ShareBridge.respondErr(id, "E_SHARE_FAILED",
                        "FileProvider could not map file: " + e.getMessage());
                return;
            }

            shareIntent.setClipData(ClipData.newRawUri("", uri));
            shareIntent.putExtra(Intent.EXTRA_STREAM, uri);
            shareIntent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
        }

        shareIntent.setType(mimeType);

        // Chooser + callback intent.
        final String pkg = activity.getPackageName();
        final String action = pkg + ".CHOOSER_TARGET_SELECTED."
                + System.currentTimeMillis();

        final Intent callbackIntent = new Intent(action);
        callbackIntent.setPackage(pkg);

        int piFlags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {  // API 31
            piFlags |= PendingIntent.FLAG_MUTABLE;
        }
        final int requestCode = (int) (System.currentTimeMillis() & 0x7fffffff);
        final PendingIntent pendingIntent = PendingIntent.getBroadcast(
                activity, requestCode, callbackIntent, piFlags);

        final Intent chooser = Intent.createChooser(shareIntent, title);
        chooser.putExtra(Intent.EXTRA_CHOSEN_COMPONENT_INTENT_SENDER,
                pendingIntent.getIntentSender());

        // Register one-shot broadcast receiver BEFORE startActivity.
        final BroadcastReceiver[] receiverHolder = new BroadcastReceiver[1];
        final BroadcastReceiver receiver = new BroadcastReceiver() {
            private boolean _handled = false;

            @Override
            public void onReceive(Context context, Intent intent) {
                if (_handled) return;
                _handled = true;

                ComponentName cname = getChosenComponent(intent);
                String activityType = (cname != null)
                        ? cname.flattenToShortString()
                        : "UnknownActivity";

                respondCompleted(id, activityType);
                safeUnregister(context, receiverHolder[0]);
                clearPending();
            }
        };
        receiverHolder[0] = receiver;

        IntentFilter filter = new IntentFilter(action);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) { // API 34
            activity.registerReceiver(receiver, filter,
                    Context.RECEIVER_NOT_EXPORTED);
        } else {
            activity.registerReceiver(receiver, filter);
        }

        // Store pending state.
        _pending = new PendingShare(id, receiver, thresholdMs,
                System.currentTimeMillis());

        // Launch on the UI thread.
        activity.runOnUiThread(new Runnable() {
            @Override
            public void run() {
                try {
                    activity.startActivity(chooser);
                } catch (Exception e) {
                    Log.e(TAG, "startActivity failed", e);
                    safeUnregister(activity, receiverHolder[0]);
                    clearPending();
                    ShareBridge.respondErr(id, "E_SHARE_FAILED",
                            "Could not start share activity: " + e.getMessage());
                }
            }
        });
    }

    // -------------------------------------------------------------------------
    // Lifecycle callbacks — resume fallback
    // -------------------------------------------------------------------------

    /**
     * Register {@link Application.ActivityLifecycleCallbacks} on the application
     * so we can detect when the game activity resumes after a share chooser.
     * Called once from {@link #init(Context)}.
     */
    private static void registerLifecycleCallbacks() {
        Application app = (Application) _appContext;
        app.registerActivityLifecycleCallbacks(
                new Application.ActivityLifecycleCallbacks() {

                    @Override
                    public void onActivityResumed(Activity activity) {
                        // Only act for the game activity, and only while a share is pending.
                        Activity gameActivity = com.cocos.lib.GlobalObject.getActivity();
                        if (activity != gameActivity) return;
                        if (_pending == null) return;

                        PendingShare ps = _pending;
                        long elapsed = System.currentTimeMillis() - ps.startTimeMs;

                        if (elapsed > ps.thresholdMs) {
                            // Enough time passed — treat as completed without component info.
                            respondCompleted(ps.id, "UnknownActivity");
                        } else {
                            // Resumed very quickly — treat as canceled (user dismissed).
                            respondCanceled(ps.id);
                        }

                        safeUnregister(activity, ps.receiver);
                        clearPending();
                    }

                    // ----- Unused callbacks — required by the interface -----

                    @Override
                    public void onActivityCreated(Activity activity, Bundle savedInstanceState) {}

                    @Override
                    public void onActivityStarted(Activity activity) {}

                    @Override
                    public void onActivityPaused(Activity activity) {}

                    @Override
                    public void onActivityStopped(Activity activity) {}

                    @Override
                    public void onActivitySaveInstanceState(Activity activity, Bundle outState) {}

                    @Override
                    public void onActivityDestroyed(Activity activity) {}
                });
    }

    // -------------------------------------------------------------------------
    // Response helpers
    // -------------------------------------------------------------------------

    /**
     * Respond with {@code result:"completed"} and the chosen activity type.
     *
     * @param id           JS request id.
     * @param activityType Flat component name or {@code "UnknownActivity"}.
     */
    private static void respondCompleted(int id, String activityType) {
        try {
            JSONObject data = new JSONObject();
            data.put("result", "completed");
            data.put("activityType", activityType);
            ShareBridge.respondOk(id, data);
        } catch (JSONException e) {
            Log.e(TAG, "respondCompleted: JSON build failed", e);
        }
    }

    /**
     * Respond with {@code result:"canceled"}.
     *
     * @param id JS request id.
     */
    private static void respondCanceled(int id) {
        try {
            JSONObject data = new JSONObject();
            data.put("result", "canceled");
            data.put("activityType", JSONObject.NULL);
            ShareBridge.respondOk(id, data);
        } catch (JSONException e) {
            Log.e(TAG, "respondCanceled: JSON build failed", e);
        }
    }

    // -------------------------------------------------------------------------
    // Utilities
    // -------------------------------------------------------------------------

    /**
     * Extract the {@link ComponentName} of the chosen share target from the
     * broadcast intent.  Uses the API-33 typed overload when available,
     * otherwise falls back to the deprecated {@code getParcelableExtra(String)}.
     *
     * @param intent The broadcast intent received by the chooser callback.
     * @return The chosen {@link ComponentName}, or {@code null} if unavailable.
     */
    private static ComponentName getChosenComponent(Intent intent) {
        if (intent == null) return null;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) { // API 33
            return intent.getParcelableExtra(
                    Intent.EXTRA_CHOSEN_COMPONENT, ComponentName.class);
        } else {
            //noinspection deprecation
            return intent.getParcelableExtra(Intent.EXTRA_CHOSEN_COMPONENT);
        }
    }

    /**
     * Unregister a receiver, swallowing any {@link IllegalArgumentException}
     * that would be thrown if the receiver was never registered or was already
     * unregistered.
     *
     * @param context  Context to unregister from.
     * @param receiver Receiver to unregister; may be {@code null}.
     */
    private static void safeUnregister(Context context, BroadcastReceiver receiver) {
        if (receiver == null) return;
        try {
            context.unregisterReceiver(receiver);
        } catch (IllegalArgumentException ignored) {
            // Already unregistered — safe to ignore.
        }
    }

    /** Clear the pending share state. */
    private static void clearPending() {
        _pending = null;
    }

    // -------------------------------------------------------------------------
    // Internal state holder
    // -------------------------------------------------------------------------

    /** Immutable snapshot of a pending share operation. */
    private static final class PendingShare {
        final int id;
        final BroadcastReceiver receiver;
        final long thresholdMs;
        final long startTimeMs;

        PendingShare(int id, BroadcastReceiver receiver,
                long thresholdMs, long startTimeMs) {
            this.id = id;
            this.receiver = receiver;
            this.thresholdMs = thresholdMs;
            this.startTimeMs = startTimeMs;
        }
    }
}
