// apps/mobile/ios/CareCompanion/WellnessVitals.swift
//
// Native module that queries HealthKit for daily wellness vitals:
//   - Today's step count (HKQuantityType.stepCount, cumulative sum)
//   - Latest heart rate (HKQuantityType.heartRate, most recent sample)
//   - Last night's sleep duration (HKCategoryType.sleepAnalysis)
//
// Exposed to React Native as NativeModules.WellnessVitals.

import Foundation
import HealthKit

@objc(WellnessVitals)
class WellnessVitals: NSObject {

  private let store = HKHealthStore()

  // MARK: - React Native bridge

  @objc static func requiresMainQueueSetup() -> Bool { return false }

  /// Request read-only authorization for step count, heart rate, and sleep analysis.
  @objc func requestAuthorization(_ resolve: @escaping RCTPromiseResolveBlock,
                                   rejecter reject: @escaping RCTPromiseRejectBlock) {
    guard HKHealthStore.isHealthDataAvailable() else {
      resolve(false)
      return
    }

    let types: Set<HKObjectType> = [
      HKQuantityType.quantityType(forIdentifier: .stepCount)!,
      HKQuantityType.quantityType(forIdentifier: .heartRate)!,
      HKCategoryType.categoryType(forIdentifier: .sleepAnalysis)!,
    ]

    store.requestAuthorization(toShare: nil, read: types) { success, error in
      if let error = error {
        reject("AUTH_ERROR", error.localizedDescription, error)
      } else {
        resolve(success)
      }
    }
  }

  /// Fetch today's vitals and return { steps, heartRate, sleepHours }.
  @objc func fetchDailyVitals(_ resolve: @escaping RCTPromiseResolveBlock,
                               rejecter reject: @escaping RCTPromiseRejectBlock) {
    guard HKHealthStore.isHealthDataAvailable() else {
      resolve(["steps": 0, "heartRate": NSNull(), "sleepHours": NSNull()])
      return
    }

    let group = DispatchGroup()
    var steps: Double = 0
    var heartRate: Double? = nil
    var sleepHours: Double? = nil

    // --- Steps: cumulative sum for today ---
    group.enter()
    fetchTodaySteps { value in
      steps = value
      group.leave()
    }

    // --- Heart rate: most recent sample ---
    group.enter()
    fetchLatestHeartRate { value in
      heartRate = value
      group.leave()
    }

    // --- Sleep: total asleep duration from last night ---
    group.enter()
    fetchLastNightSleep { value in
      sleepHours = value
      group.leave()
    }

    group.notify(queue: .main) {
      let result: [String: Any] = [
        "steps": steps,
        "heartRate": heartRate as Any,
        "sleepHours": sleepHours as Any,
      ]
      resolve(result)
    }
  }

  // MARK: - HealthKit queries

  private func fetchTodaySteps(completion: @escaping (Double) -> Void) {
    guard let stepType = HKQuantityType.quantityType(forIdentifier: .stepCount) else {
      completion(0)
      return
    }

    let calendar = Calendar.current
    let startOfDay = calendar.startOfDay(for: Date())
    let predicate = HKQuery.predicateForSamples(withStart: startOfDay, end: Date(), options: .strictStartDate)

    let query = HKStatisticsQuery(quantityType: stepType, quantitySamplePredicate: predicate, options: .cumulativeSum) { _, statistics, _ in
      let sum = statistics?.sumQuantity()?.doubleValue(for: .count()) ?? 0
      completion(sum)
    }
    store.execute(query)
  }

  private func fetchLatestHeartRate(completion: @escaping (Double?) -> Void) {
    guard let hrType = HKQuantityType.quantityType(forIdentifier: .heartRate) else {
      completion(nil)
      return
    }

    let sortDescriptor = NSSortDescriptor(key: HKSampleSortIdentifierEndDate, ascending: false)
    let query = HKSampleQuery(sampleType: hrType, predicate: nil, limit: 1, sortDescriptors: [sortDescriptor]) { _, samples, _ in
      guard let sample = samples?.first as? HKQuantitySample else {
        completion(nil)
        return
      }
      let bpm = sample.quantity.doubleValue(for: HKUnit.count().unitDivided(by: .minute()))
      completion(bpm)
    }
    store.execute(query)
  }

  private func fetchLastNightSleep(completion: @escaping (Double?) -> Void) {
    guard let sleepType = HKCategoryType.categoryType(forIdentifier: .sleepAnalysis) else {
      completion(nil)
      return
    }

    // Look back 24 hours for sleep samples
    let now = Date()
    let yesterday = Calendar.current.date(byAdding: .hour, value: -24, to: now)!
    let predicate = HKQuery.predicateForSamples(withStart: yesterday, end: now, options: .strictStartDate)
    let sortDescriptor = NSSortDescriptor(key: HKSampleSortIdentifierEndDate, ascending: false)

    let query = HKSampleQuery(sampleType: sleepType, predicate: predicate, limit: HKObjectQueryNoLimit, sortDescriptors: [sortDescriptor]) { _, samples, _ in
      guard let samples = samples as? [HKCategorySample], !samples.isEmpty else {
        completion(nil)
        return
      }

      // Sum only "asleep" samples (InBed is excluded)
      var totalSeconds: Double = 0
      for sample in samples {
        let value = sample.value
        // HKCategoryValueSleepAnalysis: asleepUnspecified = 1, asleepCore = 3, asleepDeep = 4, asleepREM = 5
        if value == HKCategoryValueSleepAnalysis.asleepUnspecified.rawValue ||
           value == HKCategoryValueSleepAnalysis.asleepCore.rawValue ||
           value == HKCategoryValueSleepAnalysis.asleepDeep.rawValue ||
           value == HKCategoryValueSleepAnalysis.asleepREM.rawValue {
          totalSeconds += sample.endDate.timeIntervalSince(sample.startDate)
        }
      }

      completion(totalSeconds > 0 ? totalSeconds / 3600.0 : nil)
    }
    store.execute(query)
  }
}
