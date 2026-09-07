package com.cocos.share;

import android.content.Context;
import android.util.Log;

import com.cocos.lib.CocosHelper;
import com.cocos.lib.JsbBridgeWrapper;

import org.json.JSONException;
import org.json.JSONObject;

/**
 * Wire-protocol bridge between the Cocos JS layer and {@link ShareServiceHub}.
 *
 * <p>Registers a {@link JsbBridgeWrapper} script-event listener on channel
 * {@code "share"}.  All JS→native messages arrive as a JSON string:</p>
 * <pre>
 *   { "id": &lt;int&gt;, "method": "share", "args": { ... } }
 * </pre>
 *
 * <p>All native→JS messages are dispatched as JSON on the same channel:</p>
 * <pre>
 *   Response (ok):  { "kind":"response","id":N,"success":true,"data":{...} }
 *   Response (err): { "kind":"response","id":N,"success":false,
 *                     "error":{"code":"...","message":"..."} }
 * </pre>
 *
 * <p>Thread safety: the JsbBridgeWrapper listener fires on the Cocos game
 * thread.  Responses are marshalled back to the game thread via
 * {@link CocosHelper#runOnGameThread(Runnable)}.</p>
 */
public class ShareBridge {

    private static final String TAG = "ShareBridge";
    private static final String CHANNEL = "share";

    /**
     * Register the JsbBridgeWrapper listener.  Called once from
     * {@link ShareInitProvider#onCreate()}.
     *
     * @param context Application context used to initialise
     *                {@link ShareServiceHub}.
     */
    public static void register(final Context context) {
        Log.d(TAG, "register()");
        ShareServiceHub.init(context);

        JsbBridgeWrapper.getInstance().addScriptEventListener(
                CHANNEL,
                new JsbBridgeWrapper.OnScriptEventListener() {
                    @Override
                    public void onScriptEvent(String arg) {
                        handleIncoming(arg != null ? arg : "");
                    }
                });

        Log.d(TAG, "listener registered on channel \"" + CHANNEL + "\"");
    }

    // -------------------------------------------------------------------------
    // Incoming dispatch
    // -------------------------------------------------------------------------

    private static void handleIncoming(String raw) {
        final int id;
        final String method;
        final JSONObject args;

        // Defensive parse — malformed JSON is a developer error.
        try {
            JSONObject envelope = new JSONObject(raw);
            id = envelope.getInt("id");
            method = envelope.getString("method");
            JSONObject argsObj = envelope.optJSONObject("args");
            args = argsObj != null ? argsObj : new JSONObject();
        } catch (JSONException e) {
            Log.e(TAG, "parse error on incoming message: " + raw, e);
            // No valid id to respond to — use 0 as a sentinel.
            respondErr(0, "E_DEVELOPER_ERROR", "Malformed envelope: " + e.getMessage());
            return;
        }

        Log.d(TAG, "dispatch id=" + id + " method=" + method);

        if ("share".equals(method)) {
            ShareServiceHub.share(id, args);
        } else {
            respondErr(id, "E_NOT_SUPPORTED", "Unknown method: " + method);
        }
    }

    // -------------------------------------------------------------------------
    // Outbound helpers
    // -------------------------------------------------------------------------

    /**
     * Send a successful response for request {@code id}.
     *
     * @param id   Request identifier from the JS envelope.
     * @param data A {@link JSONObject} containing the response payload.
     */
    public static void respondOk(int id, JSONObject data) {
        try {
            JSONObject payload = new JSONObject();
            payload.put("kind", "response");
            payload.put("id", id);
            payload.put("success", true);
            payload.put("data", data != null ? data : JSONObject.NULL);
            sendToScript(payload.toString());
        } catch (JSONException e) {
            Log.e(TAG, "respondOk: JSON build failed", e);
        }
    }

    /**
     * Send an error response for request {@code id}.
     *
     * @param id      Request identifier from the JS envelope.
     * @param code    Error code string (e.g. {@code "E_SHARE_FAILED"}).
     * @param message Human-readable description of the error.
     */
    public static void respondErr(int id, String code, String message) {
        try {
            JSONObject error = new JSONObject();
            error.put("code", code);
            error.put("message", message);

            JSONObject payload = new JSONObject();
            payload.put("kind", "response");
            payload.put("id", id);
            payload.put("success", false);
            payload.put("error", error);
            sendToScript(payload.toString());
        } catch (JSONException e) {
            Log.e(TAG, "respondErr: JSON build failed", e);
        }
    }

    // -------------------------------------------------------------------------
    // Transport
    // -------------------------------------------------------------------------

    private static void sendToScript(final String json) {
        // CocosHelper.runOnGameThread ensures the event reaches the JS engine
        // on the correct thread — mirrors the pattern used by libadmob and libiap.
        CocosHelper.runOnGameThread(new Runnable() {
            @Override
            public void run() {
                JsbBridgeWrapper.getInstance().dispatchEventToScript(CHANNEL, json);
            }
        });
    }
}
