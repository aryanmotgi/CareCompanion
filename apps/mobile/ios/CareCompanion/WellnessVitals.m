// apps/mobile/ios/CareCompanion/WellnessVitals.m
//
// Objective-C bridge for the WellnessVitals Swift native module.
// Exposes requestAuthorization and fetchDailyVitals to React Native.

#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(WellnessVitals, NSObject)

RCT_EXTERN_METHOD(requestAuthorization:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(fetchDailyVitals:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

@end
