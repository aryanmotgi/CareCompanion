import Foundation
import EventKit

@objc(CalendarBridge)
class CalendarBridge: NSObject {

  private let store = EKEventStore()

  // MARK: - Authorization

  @objc func requestAuthorization(_ resolve: @escaping RCTPromiseResolveBlock,
                                   rejecter reject: @escaping RCTPromiseRejectBlock) {
    if #available(iOS 17.0, *) {
      store.requestFullAccessToEvents { granted, error in
        if let error = error {
          reject("CALENDAR_AUTH_ERROR", error.localizedDescription, error)
        } else {
          resolve(granted)
        }
      }
    } else {
      store.requestAccess(to: .event) { granted, error in
        if let error = error {
          reject("CALENDAR_AUTH_ERROR", error.localizedDescription, error)
        } else {
          resolve(granted)
        }
      }
    }
  }

  /// Fetches events from `daysBack` days ago through `daysAhead` days from now,
  /// across all calendars the user has granted access to. Filtering by medical
  /// keywords happens in JS — bridge stays simple.
  @objc func fetchEvents(_ daysBack: NSNumber,
                          daysAhead: NSNumber,
                          maxEvents: NSNumber,
                          resolver resolve: @escaping RCTPromiseResolveBlock,
                          rejecter reject: @escaping RCTPromiseRejectBlock) {
    let calendar = Calendar.current
    let now = Date()
    let start = calendar.date(byAdding: .day, value: -daysBack.intValue, to: now) ?? now
    let end = calendar.date(byAdding: .day, value: daysAhead.intValue, to: now) ?? now

    let predicate = store.predicateForEvents(withStart: start, end: end, calendars: nil)
    // Cap the result set up front so heavy calendars cannot blow up the bridge
    // payload. Sorted ascending by startDate so the cap drops the furthest-out
    // events rather than upcoming ones the user actually cares about.
    let raw = store.events(matching: predicate)
      .sorted { $0.startDate < $1.startDate }
    let cap = max(0, maxEvents.intValue)
    let events = cap > 0 && raw.count > cap ? Array(raw.prefix(cap)) : raw

    let iso = ISO8601DateFormatter()
    let mapped: [[String: Any]] = events.map { ev in
      var dict: [String: Any] = [
        "id": ev.eventIdentifier ?? "",
        "title": ev.title ?? "",
        "startDate": iso.string(from: ev.startDate),
        "endDate": iso.string(from: ev.endDate),
        "calendarTitle": ev.calendar?.title ?? "",
      ]
      dict["location"] = ev.location ?? NSNull()
      dict["notes"] = ev.notes ?? NSNull()
      dict["url"] = ev.url?.absoluteString ?? NSNull()
      return dict
    }

    resolve(mapped)
  }

  @objc static func requiresMainQueueSetup() -> Bool { false }
}
