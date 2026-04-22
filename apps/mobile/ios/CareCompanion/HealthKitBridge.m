//
//  HealthKitBridge.m
//  CareCompanion
//
//  Objective-C bridge that exposes the Swift HealthKitBridge class to
//  React Native's module registry.  Keep this file minimal — all logic
//  lives in HealthKitBridge.swift.
//

#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(HealthKitBridge, NSObject)

/// Request HealthKit authorization for all clinical record types.
RCT_EXTERN_METHOD(requestAuthorization:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

/// Fetch all available clinical records across every supported type.
RCT_EXTERN_METHOD(fetchClinicalRecords:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

@end
