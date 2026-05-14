#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(CalendarBridge, NSObject)

RCT_EXTERN_METHOD(requestAuthorization:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(fetchEvents:(nonnull NSNumber *)daysBack
                  daysAhead:(nonnull NSNumber *)daysAhead
                  maxEvents:(nonnull NSNumber *)maxEvents
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

@end
