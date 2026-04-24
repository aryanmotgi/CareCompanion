import Foundation
import WidgetKit

/// Native module that writes emergency data to the shared App Group UserDefaults
/// so the WidgetKit extension can read it. Also triggers widget timeline refresh.
@objc(EmergencyWidgetBridge)
class EmergencyWidgetBridge: NSObject {

    private let suiteName = "group.com.aryanmotgi.carecompanion"

    @objc
    func updateEmergencyData(_ data: NSDictionary) {
        guard let defaults = UserDefaults(suiteName: suiteName) else { return }

        if let name = data["patientName"] as? String {
            defaults.set(name, forKey: "emergency_patientName")
        }
        if let bloodType = data["bloodType"] as? String {
            defaults.set(bloodType, forKey: "emergency_bloodType")
        }
        if let allergies = data["allergies"] as? String {
            defaults.set(allergies, forKey: "emergency_allergies")
        }
        if let conditions = data["conditions"] as? String {
            defaults.set(conditions, forKey: "emergency_conditions")
        }
        if let contactName = data["emergencyContactName"] as? String {
            defaults.set(contactName, forKey: "emergency_contactName")
        }
        if let contactPhone = data["emergencyContactPhone"] as? String {
            defaults.set(contactPhone, forKey: "emergency_contactPhone")
        }
        if let insuranceId = data["insuranceId"] as? String {
            defaults.set(insuranceId, forKey: "emergency_insuranceId")
        }

        // Medications: array of {name, dose}
        if let medications = data["medications"] as? [[String: String]] {
            if let jsonData = try? JSONSerialization.data(withJSONObject: medications) {
                defaults.set(jsonData, forKey: "emergency_medications")
            }
        }

        defaults.synchronize()

        // Tell WidgetKit to refresh
        if #available(iOS 14.0, *) {
            WidgetCenter.shared.reloadAllTimelines()
        }
    }

    @objc
    static func requiresMainQueueSetup() -> Bool {
        return false
    }
}
