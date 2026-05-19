/**
 * Calendar (EventKit) sync — backed by the CalendarBridge Swift module.
 *
 * Reads events from the user's iOS calendars, filters to medical-looking ones
 * via a keyword whitelist, and POSTs them as appointments to the existing
 * /api/records/appointments endpoint.
 *
 * Privacy: the bridge returns every event in the window. Filtering happens in
 * JS so we can iterate on the keyword set without a native rebuild, and so
 * non-medical events never leave the device once we drop them.
 */
import { NativeModules, Platform } from 'react-native'
import { apiClient } from './api'
import { isMedicalEvent as isMedicalEventPure } from './internal/pure'

interface RawCalendarEvent {
  id: string
  title: string
  startDate: string  // ISO 8601
  endDate: string
  calendarTitle: string
  location: string | null
  notes: string | null
  url: string | null
}

interface NativeCalendarBridge {
  requestAuthorization(): Promise<boolean>
  fetchEvents(daysBack: number, daysAhead: number, maxEvents: number): Promise<RawCalendarEvent[]>
}

const DEFAULT_MAX_EVENTS = 500

const Bridge: NativeCalendarBridge | null =
  Platform.OS === 'ios' ? (NativeModules.CalendarBridge ?? null) : null

function isMedicalEvent(ev: RawCalendarEvent): boolean {
  return isMedicalEventPure(ev)
}

export async function requestCalendarPermissions(): Promise<boolean> {
  if (!Bridge) return false
  try {
    return await Bridge.requestAuthorization()
  } catch {
    return false
  }
}

/**
 * Fetch medical-only calendar events in a window (default: 30 days back, 90
 * days ahead) and POST each as an appointment via the existing API client.
 * Returns counts; never throws — partial failures just reduce `created`.
 */
export async function syncMedicalCalendarEvents(
  csrfToken: string,
  daysBack = 30,
  daysAhead = 90,
  maxEvents = DEFAULT_MAX_EVENTS,
): Promise<{ scanned: number; matched: number; created: number; errors: number }> {
  if (!Bridge) return { scanned: 0, matched: 0, created: 0, errors: 0 }

  let events: RawCalendarEvent[]
  try {
    events = await Bridge.fetchEvents(daysBack, daysAhead, maxEvents)
  } catch (err) {
    console.warn('[Calendar] fetchEvents failed:', err instanceof Error ? err.message : String(err))
    return { scanned: 0, matched: 0, created: 0, errors: 1 }
  }

  const medical = events.filter(isMedicalEvent)
  let created = 0
  let errors = 0

  for (const ev of medical) {
    try {
      await apiClient.appointments.create(
        {
          // The backend appointments endpoint accepts arbitrary keys; matches
          // existing /api/records/appointments POST shape.
          externalId: ev.id,
          source: 'eventkit',
          title: ev.title,
          dateTime: ev.startDate,
          endDateTime: ev.endDate,
          location: ev.location,
          notes: ev.notes,
        },
        csrfToken,
      )
      created += 1
    } catch (err) {
      errors += 1
      console.warn('[Calendar] appointments.create failed for', ev.id, err instanceof Error ? err.message : String(err))
    }
  }

  return { scanned: events.length, matched: medical.length, created, errors }
}
