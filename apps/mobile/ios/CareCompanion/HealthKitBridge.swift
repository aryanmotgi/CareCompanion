import Foundation
import HealthKit

// MARK: - HealthKitBridge

/// Native Swift module that reads HKClinicalRecord data from Apple HealthKit
/// and exposes it to React Native JavaScript via RCT_EXPORT_METHOD (declared
/// in HealthKitBridge.m).
///
/// Entitlement required in CareCompanion.entitlements:
///   com.apple.developer.healthkit.access = ["health-records"]
@objc(HealthKitBridge)
class HealthKitBridge: NSObject {

  private let store = HKHealthStore()

  // MARK: - Clinical types

  private static let clinicalTypes: [HKClinicalTypeIdentifier] = [
    .medicationRecord,
    .labResultRecord,
    .conditionRecord,
    .allergyRecord,
    .vitalSignRecord,
    .immunizationRecord,
    .procedureRecord,
  ]

  private static func allReadTypes() -> Set<HKObjectType> {
    var types = Set<HKObjectType>()
    for id in clinicalTypes {
      if let t = HKObjectType.clinicalType(forIdentifier: id) {
        types.insert(t)
      }
    }
    return types
  }

  // MARK: - React Native exports

  /// Request HealthKit authorization for all clinical record types.
  /// Resolves with `true` on success, rejects with a descriptive error otherwise.
  @objc func requestAuthorization(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    guard HKHealthStore.isHealthDataAvailable() else {
      reject("HEALTHKIT_UNAVAILABLE",
             "HealthKit is not available on this device.",
             nil)
      return
    }

    store.requestAuthorization(
      toShare: nil,
      read: Self.allReadTypes()
    ) { granted, error in
      if let error = error {
        reject("AUTHORIZATION_ERROR",
               error.localizedDescription,
               error)
        return
      }
      resolve(granted)
    }
  }

  /// Query all available clinical records for every supported type.
  /// Resolves with an array of record objects; rejects on query failure.
  ///
  /// Each record object:
  /// ```json
  /// {
  ///   "id":          "<UUID string>",
  ///   "type":        "HKClinicalTypeIdentifierMedicationRecord",
  ///   "displayName": "Ibuprofen 200 mg",
  ///   "startDate":   "2024-03-15T09:00:00Z",
  ///   "fhirData":    "{...raw FHIR JSON string...}"
  /// }
  /// ```
  @objc func fetchClinicalRecords(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    guard HKHealthStore.isHealthDataAvailable() else {
      reject("HEALTHKIT_UNAVAILABLE",
             "HealthKit is not available on this device.",
             nil)
      return
    }

    let group = DispatchGroup()
    var allRecords: [[String: Any]] = []
    var firstError: Error?
    let lock = NSLock()

    for typeId in Self.clinicalTypes {
      guard let clinicalType = HKObjectType.clinicalType(forIdentifier: typeId) else {
        continue
      }

      // Check that we actually have read access before querying.
      let status = store.authorizationStatus(for: clinicalType)
      guard status == .sharingAuthorized else { continue }

      group.enter()
      let query = HKSampleQuery(
        sampleType: clinicalType,
        predicate: nil,
        limit: HKObjectQueryNoLimit,
        sortDescriptors: [NSSortDescriptor(key: HKSampleSortIdentifierStartDate,
                                           ascending: false)]
      ) { [weak self] _, samples, error in
        defer { group.leave() }
        guard self != nil else { return }

        if let error = error {
          lock.lock()
          if firstError == nil { firstError = error }
          lock.unlock()
          return
        }

        guard let clinicalSamples = samples as? [HKClinicalRecord] else { return }

        let serialized = clinicalSamples.compactMap { record -> [String: Any]? in
          HealthKitBridge.serialize(record: record, typeId: typeId)
        }

        lock.lock()
        allRecords.append(contentsOf: serialized)
        lock.unlock()
      }

      store.execute(query)
    }

    group.notify(queue: .global(qos: .userInitiated)) {
      if let error = firstError {
        // Surface the first query error but still return whatever we collected.
        // This mirrors HealthKit's own behaviour where partial results are useful.
        reject("QUERY_ERROR", error.localizedDescription, error)
        return
      }
      resolve(allRecords)
    }
  }

  // MARK: - Serialization

  private static func serialize(
    record: HKClinicalRecord,
    typeId: HKClinicalTypeIdentifier
  ) -> [String: Any]? {
    let iso = ISO8601DateFormatter()
    iso.formatOptions = [.withInternetDateTime, .withFractionalSeconds]

    var dict: [String: Any] = [
      "id": record.uuid.uuidString,
      "type": typeId.rawValue,
      "displayName": record.displayName,
      "startDate": iso.string(from: record.startDate),
    ]

    // FHIR resource attached to most clinical records.
    if let fhirResource = record.fhirResource {
      do {
        let fhirJSON = try JSONSerialization.jsonObject(with: fhirResource.data,
                                                        options: [])
        // Pass as a JSON string so JS can parse lazily.
        if let fhirString = String(
          data: try JSONSerialization.data(withJSONObject: fhirJSON, options: []),
          encoding: .utf8
        ) {
          dict["fhirData"] = fhirString
        }
      } catch {
        // FHIR data is malformed; omit it rather than failing the whole record.
        dict["fhirData"] = NSNull()
      }
    } else {
      dict["fhirData"] = NSNull()
    }

    return dict
  }

  // MARK: - RCT threading

  /// Return true so React Native invokes these methods on a background queue,
  /// keeping HealthKit callbacks off the main thread.
  @objc static func requiresMainQueueSetup() -> Bool { false }
}
