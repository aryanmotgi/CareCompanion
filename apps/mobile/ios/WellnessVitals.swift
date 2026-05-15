import Foundation
import HealthKit

@objc(WellnessVitals)
class WellnessVitals: NSObject {

  private let store = HKHealthStore()

  // MARK: - Authorization

  @objc func requestAuthorization(_ resolve: @escaping RCTPromiseResolveBlock,
                                   rejecter reject: @escaping RCTPromiseRejectBlock) {
    guard HKHealthStore.isHealthDataAvailable() else {
      resolve(false)
      return
    }
    var readTypes = Set<HKObjectType>()
    if let t = HKObjectType.quantityType(forIdentifier: .stepCount)   { readTypes.insert(t) }
    if let t = HKObjectType.quantityType(forIdentifier: .heartRate)   { readTypes.insert(t) }
    if let t = HKObjectType.categoryType(forIdentifier: .sleepAnalysis) { readTypes.insert(t) }

    store.requestAuthorization(toShare: [], read: readTypes) { success, error in
      if let error = error {
        reject("WELLNESS_AUTH_ERROR", error.localizedDescription, error)
      } else {
        resolve(success)
      }
    }
  }

  // MARK: - Fetch

  // Alias kept for the JS service layer (`NativeModules.WellnessVitals.today()`).
  @objc func today(_ resolve: @escaping RCTPromiseResolveBlock,
                    rejecter reject: @escaping RCTPromiseRejectBlock) {
    fetchDailyVitals(resolve, rejecter: reject)
  }

  @objc func fetchDailyVitals(_ resolve: @escaping RCTPromiseResolveBlock,
                               rejecter reject: @escaping RCTPromiseRejectBlock) {
    guard HKHealthStore.isHealthDataAvailable() else {
      resolve(["steps": 0, "heartRate": NSNull(), "sleepHours": NSNull()])
      return
    }

    let group    = DispatchGroup()
    let calendar = Calendar.current
    let now      = Date()
    var steps      = 0
    var heartRate: Double? = nil
    var sleepHours: Double? = nil

    // ── Steps: cumulative sum midnight today → now ──────────────────────────
    group.enter()
    if let stepType = HKObjectType.quantityType(forIdentifier: .stepCount) {
      let start     = calendar.startOfDay(for: now)
      let predicate = HKQuery.predicateForSamples(withStart: start, end: now,
                                                  options: .strictStartDate)
      let query = HKStatisticsQuery(quantityType: stepType,
                                    quantitySamplePredicate: predicate,
                                    options: .cumulativeSum) { _, result, _ in
        defer { group.leave() }
        if let sum = result?.sumQuantity() {
          steps = Int(sum.doubleValue(for: .count()))
        }
      }
      store.execute(query)
    } else { group.leave() }

    // ── Heart rate: most recent sample ──────────────────────────────────────
    group.enter()
    if let hrType = HKObjectType.quantityType(forIdentifier: .heartRate) {
      let sort  = NSSortDescriptor(key: HKSampleSortIdentifierEndDate, ascending: false)
      let query = HKSampleQuery(sampleType: hrType, predicate: nil, limit: 1,
                                sortDescriptors: [sort]) { _, samples, _ in
        defer { group.leave() }
        if let sample = samples?.first as? HKQuantitySample {
          heartRate = sample.quantity.doubleValue(for: HKUnit(from: "count/min"))
        }
      }
      store.execute(query)
    } else { group.leave() }

    // ── Sleep: 10 pm yesterday → 8 am today ────────────────────────────────
    group.enter()
    if let sleepType = HKObjectType.categoryType(forIdentifier: .sleepAnalysis) {
      var endComps        = calendar.dateComponents([.year, .month, .day], from: now)
      endComps.hour       = 8; endComps.minute = 0; endComps.second = 0
      let sleepEnd        = calendar.date(from: endComps) ?? now
      let yesterday       = calendar.date(byAdding: .day, value: -1, to: now)!
      var startComps      = calendar.dateComponents([.year, .month, .day], from: yesterday)
      startComps.hour     = 22; startComps.minute = 0; startComps.second = 0
      let sleepStart      = calendar.date(from: startComps) ?? sleepEnd.addingTimeInterval(-10 * 3600)

      let predicate = HKQuery.predicateForSamples(withStart: sleepStart, end: sleepEnd,
                                                  options: .strictStartDate)
      let query = HKSampleQuery(sampleType: sleepType, predicate: predicate,
                                limit: HKObjectQueryNoLimit,
                                sortDescriptors: nil) { _, samples, _ in
        defer { group.leave() }
        guard let samples = samples as? [HKCategorySample] else { return }
        // Exclude inBed (0) and, on iOS 16+, awake (2). Count all actual sleep stages.
        let total = samples.filter { sample in
          let v = sample.value
          if #available(iOS 16.0, *) {
            return v != HKCategoryValueSleepAnalysis.inBed.rawValue &&
                   v != HKCategoryValueSleepAnalysis.awake.rawValue
          }
          return v != HKCategoryValueSleepAnalysis.inBed.rawValue
        }.reduce(0.0) { $0 + $1.endDate.timeIntervalSince($1.startDate) }
        if total > 0 { sleepHours = total / 3600.0 }
      }
      store.execute(query)
    } else { group.leave() }

    // ── Resolve when all three queries finish ───────────────────────────────
    group.notify(queue: .main) {
      var result: [String: Any] = ["steps": steps]
      result["heartRate"]  = heartRate  != nil ? heartRate!  as Any : NSNull()
      result["sleepHours"] = sleepHours != nil ? sleepHours! as Any : NSNull()
      resolve(result)
    }
  }

  @objc static func requiresMainQueueSetup() -> Bool { false }
}
