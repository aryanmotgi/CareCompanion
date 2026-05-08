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