import Foundation
import HealthKit
import React

@objc(HealthKitBridge)
class HealthKitBridge: NSObject {

  private let store = HKHealthStore()

  /// Clinical record types we want to read
  private var clinicalTypes: Set<HKClinicalType> {
    var types = Set<HKClinicalType>()
    let identifiers: [HKClinicalTypeIdentifier] = [
      .medicationRecord,
      .labResultRecord,
      .conditionRecord,
      .procedureRecord,
      .allergyRecord,
      .vitalSignRecord,
      .immunizationRecord,
    ]
    for id in identifiers {
      if let t = HKObjectType.clinicalType(forIdentifier: id) {
        types.insert(t)
      }
    }
    return types
  }

  // MARK: - Request Authorization

  @objc
  func requestAuthorization(_ resolve: @escaping RCTPromiseResolveBlock,
                            rejecter reject: @escaping RCTPromiseRejectBlock) {
    guard HKHealthStore.isHealthDataAvailable() else {
      resolve(false)
      return
    }

    store.requestAuthorization(toShare: nil, read: clinicalTypes) { success, error in
      if let error = error {
        reject("HEALTHKIT_AUTH", error.localizedDescription, error)
      } else {
        resolve(success)
      }
    }
  }

  // MARK: - Fetch Clinical Records

  @objc
  func fetchClinicalRecords(_ resolve: @escaping RCTPromiseResolveBlock,
                             rejecter reject: @escaping RCTPromiseRejectBlock) {
    guard HKHealthStore.isHealthDataAvailable() else {
      resolve([])
      return
    }

    var allRecords: [[String: Any]] = []
    let group = DispatchGroup()

    for clinicalType in clinicalTypes {
      group.enter()

      let query = HKSampleQuery(
        sampleType: clinicalType,
        predicate: nil,
        limit: HKObjectQueryNoLimit,
        sortDescriptors: [NSSortDescriptor(key: HKSampleSortIdentifierStartDate, ascending: false)]
      ) { _, samples, error in
        defer { group.leave() }

        guard let samples = samples as? [HKClinicalRecord] else { return }

        for record in samples {
          var dict: [String: Any] = [
            "id": record.uuid.uuidString,
            "type": record.clinicalType.identifier.rawValue,
            "displayName": record.displayName,
            "startDate": ISO8601DateFormatter().string(from: record.startDate),
          ]

          // Extract FHIR JSON if available
          if let fhirRecord = record.fhirResource,
             let jsonString = String(data: fhirRecord.data, encoding: .utf8) {
            dict["fhirData"] = jsonString
          } else {
            dict["fhirData"] = NSNull()
          }

          allRecords.append(dict)
        }
      }

      store.execute(query)
    }

    group.notify(queue: .main) {
      resolve(allRecords)
    }
  }

  // MARK: - Module config

  @objc
  static func requiresMainQueueSetup() -> Bool { return false }
}
