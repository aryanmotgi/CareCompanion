import WidgetKit
import SwiftUI

// MARK: - Shared Data Model

struct EmergencyData {
    let patientName: String
    let bloodType: String
    let allergies: String
    let medications: [MedicationItem]
    let emergencyContactName: String
    let emergencyContactPhone: String
    let insuranceId: String
    let conditions: String

    struct MedicationItem {
        let name: String
        let dose: String
    }

    static let placeholder = EmergencyData(
        patientName: "Patient Name",
        bloodType: "—",
        allergies: "NKDA",
        medications: [
            MedicationItem(name: "Methotrexate", dose: "15mg"),
            MedicationItem(name: "Ondansetron", dose: "8mg"),
        ],
        emergencyContactName: "Emergency Contact",
        emergencyContactPhone: "(555) 000-0000",
        insuranceId: "INS-000000",
        conditions: "None listed"
    )

    static func load() -> EmergencyData {
        guard let defaults = UserDefaults(suiteName: "group.com.aryanmotgi.carecompanion") else {
            return .placeholder
        }

        let patientName = defaults.string(forKey: "emergency_patientName") ?? "Unknown"
        let bloodType = defaults.string(forKey: "emergency_bloodType") ?? ""
        let allergies = defaults.string(forKey: "emergency_allergies") ?? "NKDA (No Known Drug Allergies)"
        let emergencyContactName = defaults.string(forKey: "emergency_contactName") ?? ""
        let emergencyContactPhone = defaults.string(forKey: "emergency_contactPhone") ?? ""
        let insuranceId = defaults.string(forKey: "emergency_insuranceId") ?? ""
        let conditions = defaults.string(forKey: "emergency_conditions") ?? "None listed"

        var medications: [MedicationItem] = []
        if let medsData = defaults.data(forKey: "emergency_medications"),
           let medsArray = try? JSONSerialization.jsonObject(with: medsData) as? [[String: String]] {
            medications = medsArray.map { dict in
                MedicationItem(
                    name: dict["name"] ?? "Unknown",
                    dose: dict["dose"] ?? ""
                )
            }
        }

        return EmergencyData(
            patientName: patientName,
            bloodType: bloodType,
            allergies: allergies,
            medications: medications,
            emergencyContactName: emergencyContactName,
            emergencyContactPhone: emergencyContactPhone,
            insuranceId: insuranceId,
            conditions: conditions
        )
    }
}

// MARK: - Timeline Provider

struct EmergencyTimelineProvider: TimelineProvider {
    func placeholder(in context: Context) -> EmergencyEntry {
        EmergencyEntry(date: Date(), data: .placeholder)
    }

    func getSnapshot(in context: Context, completion: @escaping (EmergencyEntry) -> Void) {
        let data = context.isPreview ? .placeholder : EmergencyData.load()
        completion(EmergencyEntry(date: Date(), data: data))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<EmergencyEntry>) -> Void) {
        let data = EmergencyData.load()
        let entry = EmergencyEntry(date: Date(), data: data)
        // Refresh every 30 minutes to pick up changes
        let nextUpdate = Calendar.current.date(byAdding: .minute, value: 30, to: Date())!
        let timeline = Timeline(entries: [entry], policy: .after(nextUpdate))
        completion(timeline)
    }
}

// MARK: - Timeline Entry

struct EmergencyEntry: TimelineEntry {
    let date: Date
    let data: EmergencyData
}

// MARK: - Colors

struct WidgetColors {
    static let background = Color(red: 0.047, green: 0.055, blue: 0.102) // #0C0E1A
    static let cardBg = Color(red: 0.08, green: 0.09, blue: 0.14)
    static let textPrimary = Color.white
    static let textSecondary = Color(white: 0.65)
    static let textMuted = Color(white: 0.45)
    static let red = Color(red: 0.86, green: 0.15, blue: 0.15) // #DC2626
    static let redBg = Color(red: 0.86, green: 0.15, blue: 0.15).opacity(0.15)
    static let amber = Color(red: 0.98, green: 0.75, blue: 0.14) // #FBBF24
}

// MARK: - Lock Screen Widget (Small / Accessory)

struct LockScreenWidgetView: View {
    let data: EmergencyData

    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            HStack(spacing: 4) {
                Image(systemName: "staroflife.fill")
                    .font(.system(size: 10, weight: .bold))
                    .foregroundColor(WidgetColors.red)
                Text("EMERGENCY")
                    .font(.system(size: 9, weight: .heavy))
                    .foregroundColor(WidgetColors.red)
            }

            Text(data.patientName)
                .font(.system(size: 13, weight: .bold))
                .foregroundColor(WidgetColors.textPrimary)
                .lineLimit(1)

            if !data.allergies.isEmpty && data.allergies != "NKDA (No Known Drug Allergies)" {
                Text(data.allergies)
                    .font(.system(size: 10, weight: .semibold))
                    .foregroundColor(WidgetColors.red)
                    .lineLimit(1)
            } else {
                Text("NKDA")
                    .font(.system(size: 10, weight: .medium))
                    .foregroundColor(WidgetColors.textSecondary)
            }

            Text("Tap for full info")
                .font(.system(size: 8))
                .foregroundColor(WidgetColors.textMuted)
        }
        .padding(12)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .background(WidgetColors.background)
    }
}

// MARK: - Home Screen Widget (Medium)

struct HomeScreenWidgetView: View {
    let data: EmergencyData

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            // Header
            HStack(spacing: 6) {
                Image(systemName: "staroflife.fill")
                    .font(.system(size: 12, weight: .bold))
                    .foregroundColor(.white)
                Text("EMERGENCY INFO")
                    .font(.system(size: 11, weight: .heavy, design: .default))
                    .tracking(0.5)
                    .foregroundColor(.white)
                Spacer()
                if !data.bloodType.isEmpty {
                    Text(data.bloodType)
                        .font(.system(size: 11, weight: .bold))
                        .foregroundColor(.white)
                        .padding(.horizontal, 6)
                        .padding(.vertical, 2)
                        .background(Color.white.opacity(0.2))
                        .cornerRadius(4)
                }
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 8)
            .background(WidgetColors.red)

            // Content
            HStack(alignment: .top, spacing: 10) {
                // Left column: Name, Allergies, Medications
                VStack(alignment: .leading, spacing: 6) {
                    Text(data.patientName)
                        .font(.system(size: 15, weight: .bold))
                        .foregroundColor(WidgetColors.textPrimary)
                        .lineLimit(1)

                    // Allergies
                    VStack(alignment: .leading, spacing: 1) {
                        Text("ALLERGIES")
                            .font(.system(size: 8, weight: .bold))
                            .tracking(0.8)
                            .foregroundColor(WidgetColors.red)
                        Text(data.allergies.isEmpty ? "NKDA" : data.allergies)
                            .font(.system(size: 11, weight: .semibold))
                            .foregroundColor(
                                data.allergies.isEmpty || data.allergies == "NKDA (No Known Drug Allergies)"
                                    ? WidgetColors.textSecondary
                                    : WidgetColors.red
                            )
                            .lineLimit(2)
                    }
                    .padding(6)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(WidgetColors.redBg)
                    .cornerRadius(6)

                    // Medications
                    if !data.medications.isEmpty {
                        VStack(alignment: .leading, spacing: 1) {
                            Text("MEDICATIONS")
                                .font(.system(size: 8, weight: .bold))
                                .tracking(0.8)
                                .foregroundColor(WidgetColors.textMuted)
                            ForEach(data.medications.prefix(3), id: \.name) { med in
                                HStack(spacing: 4) {
                                    Text(med.name)
                                        .font(.system(size: 10, weight: .medium))
                                        .foregroundColor(WidgetColors.textPrimary)
                                        .lineLimit(1)
                                    if !med.dose.isEmpty {
                                        Text(med.dose)
                                            .font(.system(size: 9))
                                            .foregroundColor(WidgetColors.textSecondary)
                                    }
                                }
                            }
                            if data.medications.count > 3 {
                                Text("+\(data.medications.count - 3) more")
                                    .font(.system(size: 9))
                                    .foregroundColor(WidgetColors.textMuted)
                            }
                        }
                    }
                }

                // Right column: Emergency Contact, Insurance
                VStack(alignment: .leading, spacing: 6) {
                    // Emergency Contact
                    if !data.emergencyContactName.isEmpty {
                        VStack(alignment: .leading, spacing: 1) {
                            Text("EMERGENCY CONTACT")
                                .font(.system(size: 8, weight: .bold))
                                .tracking(0.8)
                                .foregroundColor(WidgetColors.textMuted)
                            Text(data.emergencyContactName)
                                .font(.system(size: 11, weight: .semibold))
                                .foregroundColor(WidgetColors.textPrimary)
                                .lineLimit(1)
                            if !data.emergencyContactPhone.isEmpty {
                                Text(data.emergencyContactPhone)
                                    .font(.system(size: 10))
                                    .foregroundColor(WidgetColors.amber)
                                    .lineLimit(1)
                            }
                        }
                    }

                    // Insurance
                    if !data.insuranceId.isEmpty {
                        VStack(alignment: .leading, spacing: 1) {
                            Text("INSURANCE ID")
                                .font(.system(size: 8, weight: .bold))
                                .tracking(0.8)
                                .foregroundColor(WidgetColors.textMuted)
                            Text(data.insuranceId)
                                .font(.system(size: 10, weight: .medium))
                                .foregroundColor(WidgetColors.textPrimary)
                                .lineLimit(1)
                        }
                    }

                    // Conditions
                    if !data.conditions.isEmpty && data.conditions != "None listed" {
                        VStack(alignment: .leading, spacing: 1) {
                            Text("CONDITIONS")
                                .font(.system(size: 8, weight: .bold))
                                .tracking(0.8)
                                .foregroundColor(WidgetColors.textMuted)
                            Text(data.conditions)
                                .font(.system(size: 10))
                                .foregroundColor(WidgetColors.textSecondary)
                                .lineLimit(2)
                        }
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            }
            .padding(.horizontal, 12)
            .padding(.top, 8)
            .padding(.bottom, 10)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
        .background(WidgetColors.background)
    }
}

// MARK: - Widget Definitions

struct CareCompanionEmergencyWidget: Widget {
    let kind: String = "CareCompanionEmergencyWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: EmergencyTimelineProvider()) { entry in
            if #available(iOS 17.0, *) {
                HomeScreenWidgetView(data: entry.data)
                    .containerBackground(.fill.tertiary, for: .widget)
            } else {
                HomeScreenWidgetView(data: entry.data)
            }
        }
        .configurationDisplayName("Emergency Card")
        .description("Shows your emergency medical information — allergies, medications, and contacts.")
        .supportedFamilies([.systemMedium])
    }
}

struct CareCompanionLockScreenWidget: Widget {
    let kind: String = "CareCompanionLockScreenWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: EmergencyTimelineProvider()) { entry in
            if #available(iOS 17.0, *) {
                LockScreenWidgetView(data: entry.data)
                    .containerBackground(.fill.tertiary, for: .widget)
            } else {
                LockScreenWidgetView(data: entry.data)
            }
        }
        .configurationDisplayName("Emergency Quick View")
        .description("Shows name, allergies, and blood type on your Lock Screen.")
        .supportedFamilies([.systemSmall])
    }
}

// MARK: - Widget Bundle

@main
struct CareCompanionWidgetBundle: WidgetBundle {
    var body: some Widget {
        CareCompanionEmergencyWidget()
        CareCompanionLockScreenWidget()
    }
}

// MARK: - Previews

#if DEBUG
struct CareCompanionWidget_Previews: PreviewProvider {
    static var previews: some View {
        Group {
            HomeScreenWidgetView(data: .placeholder)
                .previewContext(WidgetPreviewContext(family: .systemMedium))
                .previewDisplayName("Home Screen — Medium")

            LockScreenWidgetView(data: .placeholder)
                .previewContext(WidgetPreviewContext(family: .systemSmall))
                .previewDisplayName("Lock Screen — Small")
        }
    }
}
#endif
