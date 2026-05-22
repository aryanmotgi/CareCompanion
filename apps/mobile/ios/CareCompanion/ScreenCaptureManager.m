// ios/CareCompanion/ScreenCaptureManager.m
// Objective-C bridge that exposes the Swift ScreenCaptureManager class to React Native.
#import <React/RCTBridgeModule.h>
#import <React/RCTEventEmitter.h>

@interface RCT_EXTERN_MODULE(ScreenCaptureManager, RCTEventEmitter)

RCT_EXTERN_METHOD(
  isCaptured:(RCTPromiseResolveBlock)resolve
  rejecter:(RCTPromiseRejectBlock)reject
)

@end
