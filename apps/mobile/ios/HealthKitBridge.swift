import Foundation
import HealthKit

@objc(HealthKitBridge)
class HealthKitBridge: NSObject {

  private let store = HKHealthStore()

  // All clinical record types we want to read
  private let clinicalTypes: Set<HKObjectType> = {
    let identifiers: [HKClinicalTypeIdentifier] = [
      .medicationRecord,
      .labResultRecord,
      .conditionRecord,
      .procedureRecord,
      .allergyRecord,
      .vitalSignRecord,
      .immunizationRecord,
    ]
    return Set(identifiers.compactMap { HKObjectType.clinicalType(forIdentifier: $0) })
  }()

  // MARK: - Authorization

  // Characteristic types — read-only, do NOT require clinical-records entitlement.
  // Safe to read on a sim with ad-hoc signing.
  private let characteristicTypes: Set<HKObjectType> = {
    let types: [HKCharacteristicTypeIdentifier] = [.dateOfBirth, .biologicalSex]
    return Set(types.compactMap { HKObjectType.characteristicType(forIdentifier: $0) })
  }()

  // MARK: - Baseline characteristics (DOB, sex at birth)

  @objc func requestBaselineAuthorization(_ resolve: @escaping RCTPromiseResolveBlock,
                                           rejecter reject: @escaping RCTPromiseRejectBlock) {
    guard HKHealthStore.isHealthDataAvailable() else { resolve(false); return }
    store.requestAuthorization(toShare: [], read: characteristicTypes) { success, error in
      if let error = error {
        reject("HK_AUTH_ERROR", error.localizedDescription, error)
      } else {
        resolve(success)
      }
    }
  }

  /// Returns { dateOfBirth: "YYYY-MM-DD" | null, sexAtBirth: "female"|"male"|"other"|"prefer_not"|null }.
  /// HealthKit doesn't tell us whether the user denied vs. just hasn't entered the value, so a null
  /// field just means "not available" — the JS layer should fall back to manual entry.
  @objc func getBaselineCharacteristics(_ resolve: @escaping RCTPromiseResolveBlock,
                                         rejecter reject: @escaping RCTPromiseRejectBlock) {
    guard HKHealthStore.isHealthDataAvailable() else {
      resolve(["dateOfBirth": NSNull(), "sexAtBirth": NSNull()])
      return
    }

    var dobIso: Any = NSNull()
    if let components = try? store.dateOfBirthComponents(),
       let date = Calendar(identifier: .gregorian).date(from: components) {
      let fmt = DateFormatter()
      fmt.dateFormat = "yyyy-MM-dd"
      fmt.timeZone = TimeZone(identifier: "UTC")
      dobIso = fmt.string(from: date)
    }

    var sex: Any = NSNull()
    if let obj = try? store.biologicalSex() {
      switch obj.biologicalSex {
      case .female: sex = "female"
      case .male: sex = "male"
      case .other: sex = "intersex"
      case .notSet: sex = NSNull()
      @unknown default: sex = NSNull()
      }
    }

    resolve(["dateOfBirth": dobIso, "sexAtBirth": sex])
  }

  // MARK: - Clinical records (separate flow; requires health-records entitlement)

  @objc func requestAuthorization(_ resolve: @escaping RCTPromiseResolveBlock,
                                   rejecter reject: @escaping RCTPromiseRejectBlock) {
    guard HKHealthStore.isHealthDataAvailable() else {
      resolve(false)
      return
    }
    store.requestAuthorization(toShare: [], read: clinicalTypes) { success, error in
      if let error = error {
        reject("HK_AUTH_ERROR", error.localizedDescription, error)
      } else {
        resolve(success)
      }
    }
  }

  // MARK: - Fetch

  @objc func fetchClinicalRecords(_ resolve: @escaping RCTPromiseResolveBlock,
                                   rejecter reject: @escaping RCTPromiseRejectBlock) {
    guard HKHealthStore.isHealthDataAvailable() else {
      resolve([])
      return
    }

    let group = DispatchGroup()
    var allRecords: [[String: Any]] = []
    let lock = NSLock()

    for type in clinicalTypes {
      guard let clinicalType = type as? HKClinicalType else { continue }
      group.enter()
      let query = HKSampleQuery(sampleType: clinicalType,
                                predicate: nil,
                                limit: HKObjectQueryNoLimit,
                                sortDescriptors: nil) { _, samples, error in
        defer { group.leave() }
        guard let samples = samples as? [HKClinicalRecord], error == nil else { return }
        let mapped = samples.map { record -> [String: Any] in
          var dict: [String: Any] = [
            "id": record.uuid.uuidString,
            "type": record.clinicalType.identifier,
            "displayName": record.displayName,
            "startDate": ISO8601DateFormatter().string(from: record.startDate),
          ]
          if let fhirResource = record.fhirResource,
             let json = try? JSONSerialization.jsonObject(with: fhirResource.data) {
            dict["fhirData"] = try? String(data: fhirResource.data, encoding: .utf8)
          } else {
            dict["fhirData"] = NSNull()
          }
          return dict
        }
        lock.lock()
        allRecords.append(contentsOf: mapped)
        lock.unlock()
      }
      store.execute(query)
    }

    group.notify(queue: .main) {
      resolve(allRecords)
    }
  }

  // MARK: - React Native export

  @objc static func requiresMainQueueSetup() -> Bool { false }
}