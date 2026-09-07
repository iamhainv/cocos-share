/**
 * ShareServiceHub.mm — Share extension iOS bridge singleton implementation
 *
 * Bootstrap pattern mirrors IapServiceHub.mm exactly:
 *   - Singleton via dispatch_once.
 *   - initShareService called from AppDelegate.mm.
 *   - JsbBridgeWrapper "share" channel listener registered once.
 *   - One share in flight at a time: pending guard returns E_SHARE_IN_PROGRESS.
 *
 * Wire protocol (must match assets/scripts/extensions/Share/Bridge.ts):
 *   JS → native : {"id":int,"method":"share","args":{"title"?,"subject"?,"content"?,"filePath"?,"mimeType"?,"customThresholdMs"?}}
 *   native → JS : {"kind":"response","id":N,"success":true,"data":{"result":"completed"|"canceled","activityType":<string|null>}}
 *                 {"kind":"response","id":N,"success":false,"error":{"code":"...","message":"..."}}
 *
 * customThresholdMs is an Android-only hint and is silently ignored on iOS.
 *
 * Threading: UIKit calls must happen on the main thread. JsbBridgeWrapper
 * dispatchEventToScript calls are also dispatched to the main queue, matching
 * the pattern established by IapServiceHub and AdServiceHub.
 */

#import "ShareServiceHub.h"

#import <UIKit/UIKit.h>

// Cocos JSB bridge — same header path used by IapServiceHub.mm.
#import "platform/apple/JsbBridgeWrapper.h"

// ---------------------------------------------------------------------------
// Channel name (must match Bridge.ts: channel "share")
// ---------------------------------------------------------------------------

static NSString *const kShareChannel = @"share";

// ---------------------------------------------------------------------------
// Wire-protocol helpers: build JSON response strings.
// Mirrors the static helper pattern from IapServiceHub.mm.
// ---------------------------------------------------------------------------

/// Build a success-response JSON string for the given call id.
static NSString *ShareResponseSuccess(NSInteger callId, NSDictionary *data) {
    NSError *jsonErr = nil;
    NSData *bodyData = [NSJSONSerialization dataWithJSONObject:@{
        @"kind"    : @"response",
        @"id"      : @(callId),
        @"success" : @YES,
        @"data"    : data,
    } options:0 error:&jsonErr];
    if (jsonErr || !bodyData) {
        // Fallback: omit data rather than crash.
        bodyData = [NSJSONSerialization dataWithJSONObject:@{
            @"kind"    : @"response",
            @"id"      : @(callId),
            @"success" : @YES,
            @"data"    : [NSNull null],
        } options:0 error:nil];
    }
    return [[NSString alloc] initWithData:bodyData encoding:NSUTF8StringEncoding];
}

/// Build an error-response JSON string for the given call id.
static NSString *ShareResponseError(NSInteger callId, NSString *code, NSString *message) {
    NSData *bodyData = [NSJSONSerialization dataWithJSONObject:@{
        @"kind"    : @"response",
        @"id"      : @(callId),
        @"success" : @NO,
        @"error"   : @{
            @"code"    : code,
            @"message" : message,
        },
    } options:0 error:nil];
    return [[NSString alloc] initWithData:bodyData encoding:NSUTF8StringEncoding];
}

// ---------------------------------------------------------------------------
// ShareServiceHub private interface
// ---------------------------------------------------------------------------

@interface ShareServiceHub ()

/** Guard flag: YES while a UIActivityViewController is presented. */
@property (nonatomic, assign) BOOL sharePending;

/** Guard against double-initialisation. */
@property (nonatomic, assign) BOOL initialised;

@end

// ---------------------------------------------------------------------------
// ShareServiceHub implementation
// ---------------------------------------------------------------------------

@implementation ShareServiceHub

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

+ (instancetype)sharedInstance {
    static ShareServiceHub *sInstance = nil;
    static dispatch_once_t sOnce;
    dispatch_once(&sOnce, ^{
        sInstance = [[super allocWithZone:NULL] init];
    });
    return sInstance;
}

+ (id)allocWithZone:(struct _NSZone *)zone { return [ShareServiceHub sharedInstance]; }
+ (id)copyWithZone:(struct _NSZone *)zone  { return [ShareServiceHub sharedInstance]; }

// ---------------------------------------------------------------------------
// Initialise
// ---------------------------------------------------------------------------

/**
 * Register the "share" script event listener.
 *
 * The static block reference mirrors the IapServiceHub pattern:
 * JsbBridgeWrapper calls [listener release] on the block, so we keep
 * a strong static reference to avoid a use-after-free.
 */
- (void)initShareService {
    if (self.initialised) { return; }
    self.initialised = YES;
    self.sharePending = NO;

    __weak __typeof__(self) wself = self;
    static OnScriptEventListener sShareListener = nil;
    sShareListener = ^(NSString *payload) {
        ShareServiceHub *hub = wself;
        if (!hub) { return; }
        [hub handleIncomingMessage:payload];
    };
    [[JsbBridgeWrapper sharedInstance] addScriptEventListener:kShareChannel listener:sShareListener];

    NSLog(@"[ShareServiceHub] initShareService — channel %@ registered", kShareChannel);
}

// ---------------------------------------------------------------------------
// Incoming message handler (called from JsbBridgeWrapper listener)
// ---------------------------------------------------------------------------

/**
 * Parse the incoming JSON envelope and dispatch the share action.
 * Malformed JSON or unknown method → send an error response (never crash).
 */
- (void)handleIncomingMessage:(NSString *)payload {
    NSData *data = [payload dataUsingEncoding:NSUTF8StringEncoding];
    if (!data) {
        NSLog(@"[ShareServiceHub] empty or non-UTF8 payload, ignoring");
        return;
    }

    NSError *parseErr = nil;
    id parsed = [NSJSONSerialization JSONObjectWithData:data options:0 error:&parseErr];
    if (parseErr || ![parsed isKindOfClass:[NSDictionary class]]) {
        NSLog(@"[ShareServiceHub] malformed JSON envelope: %@", payload);
        // id unknown — cannot send a correlated error response.
        return;
    }

    NSDictionary *envelope = (NSDictionary *)parsed;
    id rawId     = envelope[@"id"];
    NSString *method = envelope[@"method"];
    id rawArgs   = envelope[@"args"];

    // Validate required fields before using them.
    if (![rawId isKindOfClass:[NSNumber class]]) {
        NSLog(@"[ShareServiceHub] envelope missing numeric id: %@", payload);
        return;
    }
    if (![method isKindOfClass:[NSString class]]) {
        NSLog(@"[ShareServiceHub] envelope missing string method: %@", payload);
        return;
    }

    NSInteger callId = [rawId integerValue];
    NSDictionary *args = [rawArgs isKindOfClass:[NSDictionary class]] ? rawArgs : @{};

    if (![method isEqualToString:@"share"]) {
        // Unknown method — return E_NOT_SUPPORTED.
        NSString *json = ShareResponseError(callId,
                                            @"E_NOT_SUPPORTED",
                                            [NSString stringWithFormat:@"Unknown method: %@", method]);
        [self sendJson:json];
        return;
    }

    [self executeShare:callId args:args];
}

// ---------------------------------------------------------------------------
// Core share logic
// ---------------------------------------------------------------------------

/**
 * Build activity items, present UIActivityViewController, and respond to JS.
 *
 * Ported from godot-share Share.swift with the following ObjC adaptations:
 *   - Swift optionals → nil checks
 *   - Swift guard → early return with error response
 *   - Swift DispatchQueue.main.async → dispatch_async(dispatch_get_main_queue(), …)
 *   - Swift UIApplication.shared.keyWindow → [UIApplication sharedApplication].keyWindow
 *     (deprecated in iOS 13 but still the simplest cross-version approach for Cocos
 *     apps that do not adopt UISceneDelegate; see Deviations note in header)
 */
- (void)executeShare:(NSInteger)callId args:(NSDictionary *)args {
    // One share at a time.
    if (self.sharePending) {
        NSString *json = ShareResponseError(callId,
                                            @"E_SHARE_IN_PROGRESS",
                                            @"A share operation is already in progress");
        [self sendJson:json];
        return;
    }

    // Extract args — all optional; nil if absent or wrong type.
    NSString *title    = [args[@"title"]    isKindOfClass:[NSString class]] ? args[@"title"]    : nil;
    NSString *subject  = [args[@"subject"]  isKindOfClass:[NSString class]] ? args[@"subject"]  : nil;
    NSString *content  = [args[@"content"]  isKindOfClass:[NSString class]] ? args[@"content"]  : nil;
    NSString *filePath = [args[@"filePath"] isKindOfClass:[NSString class]] ? args[@"filePath"] : nil;
    NSString *mimeType = [args[@"mimeType"] isKindOfClass:[NSString class]] ? args[@"mimeType"] : nil;
    // customThresholdMs is Android-only; silently ignored on iOS.

    // All UI work must run on the main thread.
    __weak __typeof__(self) wself = self;
    dispatch_async(dispatch_get_main_queue(), ^{
        ShareServiceHub *hub = wself;
        if (!hub) { return; }

        // --- Build activity items -------------------------------------------
        NSMutableArray *activityItems = [NSMutableArray array];

        if (content.length > 0) {
            [activityItems addObject:content];
        }

        if (filePath.length > 0) {
            // Strip the "file://" prefix that web/Cocos paths may carry.
            NSString *normalizedPath = filePath;
            if ([normalizedPath hasPrefix:@"file://"]) {
                normalizedPath = [normalizedPath substringFromIndex:7];
            }

            BOOL isImageMime = (mimeType.length > 0 && [mimeType hasPrefix:@"image/"]);
            if (isImageMime) {
                UIImage *image = [UIImage imageWithContentsOfFile:normalizedPath];
                if (image) {
                    [activityItems addObject:image];
                } else {
                    // Image decode failed — fall back to file URL, same as Share.swift.
                    [activityItems addObject:[NSURL fileURLWithPath:normalizedPath]];
                }
            } else {
                [activityItems addObject:[NSURL fileURLWithPath:normalizedPath]];
            }
        }

        if (activityItems.count == 0) {
            NSString *json = ShareResponseError(callId,
                                                @"E_SHARE_FAILED",
                                                @"No items to share");
            [hub sendJson:json];
            return;
        }

        // --- Find presenting view controller ---------------------------------
        UIViewController *vc = [hub topmostViewController];
        if (!vc) {
            NSString *json = ShareResponseError(callId,
                                                @"E_SHARE_FAILED",
                                                @"Could not obtain a view controller to present from");
            [hub sendJson:json];
            return;
        }

        // --- Configure UIActivityViewController ------------------------------
        UIActivityViewController *activityVC =
            [[UIActivityViewController alloc] initWithActivityItems:activityItems
                                              applicationActivities:nil];

        activityVC.excludedActivityTypes = @[
            UIActivityTypePrint,
            UIActivityTypeAssignToContact,
            UIActivityTypeAddToReadingList,
            UIActivityTypeMarkupAsPDF,
        ];

        // Set subject via the documented KVC hack (same as godot-share Share.swift).
        if (subject.length > 0) {
            [activityVC setValue:subject forKey:@"subject"];
        }

        // iPad popover source — required or the app crashes on iPad.
        if (vc.traitCollection.userInterfaceIdiom == UIUserInterfaceIdiomPad) {
            UIPopoverPresentationController *popover = activityVC.popoverPresentationController;
            popover.sourceView = vc.view;
            // Zero-size rect at the centre of the view (matches Share.swift).
            CGRect bounds = vc.view.bounds;
            popover.sourceRect = CGRectMake(CGRectGetMidX(bounds), CGRectGetMidY(bounds), 0, 0);
            popover.permittedArrowDirections = 0;
        }

        // --- Completion handler ---------------------------------------------
        activityVC.completionWithItemsHandler =
            ^(UIActivityType _Nullable activityType,
              BOOL completed,
              NSArray * _Nullable returnedItems,
              NSError * _Nullable activityError) {

            ShareServiceHub *strongHub = wself;
            if (strongHub) {
                strongHub.sharePending = NO;
            }

            NSString *json;
            if (activityError) {
                json = ShareResponseError(callId,
                                         @"E_SHARE_FAILED",
                                         activityError.localizedDescription ?: @"Share failed");
            } else if (completed) {
                id activityTypeValue = activityType ?: [NSNull null];
                json = ShareResponseSuccess(callId, @{
                    @"result"       : @"completed",
                    @"activityType" : activityTypeValue,
                });
            } else {
                json = ShareResponseSuccess(callId, @{
                    @"result"       : @"canceled",
                    @"activityType" : [NSNull null],
                });
            }

            // Respond on the game (main) thread — dispatch_get_main_queue()
            // here because completion may arrive on a background queue.
            dispatch_async(dispatch_get_main_queue(), ^{
                ShareServiceHub *strongHub2 = wself;
                if (strongHub2) {
                    [strongHub2 sendJson:json];
                }
            });
        };

        // --- Present --------------------------------------------------------
        hub.sharePending = YES;
        [vc presentViewController:activityVC animated:YES completion:nil];
    });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Walk the presentedViewController chain from the key window's root to find
 * the topmost (frontmost) view controller.
 *
 * Note on keyWindow deprecation (iOS 13+): Cocos Creator 3.x does not adopt
 * UISceneDelegate, so there is only one UIWindow and keyWindow reliably
 * returns it. If the project migrates to UISceneDelegate in the future, this
 * method should be updated to use UIWindowScene.windows. The deprecation
 * warning is suppressed with a pragma here; it is safe for iOS 13–17.
 */
- (nullable UIViewController *)topmostViewController {
#pragma clang diagnostic push
#pragma clang diagnostic ignored "-Wdeprecated-declarations"
    UIWindow *keyWindow = [UIApplication sharedApplication].keyWindow;
#pragma clang diagnostic pop

    if (!keyWindow) { return nil; }

    UIViewController *vc = keyWindow.rootViewController;
    if (!vc) { return nil; }

    while (vc.presentedViewController) {
        vc = vc.presentedViewController;
    }
    return vc;
}

/**
 * Marshal a JSON string to JS via JsbBridgeWrapper on the main queue.
 * Completion handlers may arrive on arbitrary queues, so we always hop to
 * the main queue before calling dispatchEventToScript:arg: — matching the
 * threading model of IapServiceHub and AdServiceHub.
 */
- (void)sendJson:(NSString *)json {
    if (!json) { return; }
    dispatch_async(dispatch_get_main_queue(), ^{
        [[JsbBridgeWrapper sharedInstance] dispatchEventToScript:kShareChannel arg:json];
    });
}

@end
