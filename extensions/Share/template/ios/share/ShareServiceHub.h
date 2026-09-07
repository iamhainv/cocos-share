/**
 * ShareServiceHub.h — Share extension iOS bridge singleton interface
 *
 * Registers a JsbBridgeWrapper listener on the "share" channel and presents
 * UIActivityViewController in response to share requests from JavaScript.
 *
 * Usage (AppDelegate.mm):
 *   #import "ShareServiceHub.h"
 *   [[ShareServiceHub sharedInstance] initShareService];
 *
 * Wire protocol (must match assets/scripts/extensions/Share/Bridge.ts):
 *   JS → native : {"id":int,"method":"share","args":{...}}
 *   native → JS : {"kind":"response","id":N,"success":true,"data":{"result":"completed"|"canceled","activityType":<string|null>}}
 *                 {"kind":"response","id":N,"success":false,"error":{"code":"...","message":"..."}}
 *
 * Thread safety: all JsbBridgeWrapper dispatches hop to the main queue before
 * calling dispatchEventToScript:arg:, matching the AdMob and IAP bridge pattern.
 */

#pragma once

#import <Foundation/Foundation.h>

NS_ASSUME_NONNULL_BEGIN

/**
 * ShareServiceHub — singleton that owns the "share" JS-native bridge channel.
 *
 * Lifecycle: call -initShareService once from AppDelegate
 * -application:didFinishLaunchingWithOptions:. Subsequent calls are no-ops.
 */
@interface ShareServiceHub : NSObject

/** Returns the singleton instance. */
+ (instancetype)sharedInstance;

/**
 * Register the "share" JsbBridgeWrapper listener and prepare internal state.
 * Must be called from the main thread during app launch. Idempotent.
 */
- (void)initShareService;

@end

NS_ASSUME_NONNULL_END
