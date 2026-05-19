/**
 * Wellness vitals (steps, heart rate, sleep) — backed by the WellnessVitals
 * native module. These are non-clinical HK samples and do NOT require the
 * health-records entitlement, so they work on a dev/sim build with ad-hoc
 * signing.
 *
 * Cadence: 6h background fetch via expo-background-fetch (separate task from
 * the clinical-records sync registered in background-sync.ts).
 */
import { NativeModules, Platform } from 'react-native'
import * as SecureStore from 'expo-secure-store'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { classifyStatus, backoffFor } from './internal/pure'

const API_BASE = process.env.EXPO_PUBLIC_API_BASE_URL ?? 'https://carecompanionai.org'
const WELLNESS_TASK = 'cc-wellness-sync'
const SIX_HOURS_SEC = 6 * 60 * 60
const WELLNESS_QUEUE_KEY = 'cc-wellness-retry-queue'
const WELLNESS_LAST_SYNCED_KEY = 'cc-wellness-last-synced'

type WellnessSnapshot = {
  steps: number
  heartRate: number | null
  sleepHours: number | null
}

type WellnessSyncState =
  | { status: 'idle' }
  | { status: 'syncing' }
  | { status: 'success'; at: number }
  | { status: 'error'; at: number; message: string; userActionable: boolean }
  | { status: 'retrying'; at: number; attempt: number; nextAt: number }

let currentState: WellnessSyncState = { status: 'idle' }

function emit(next: WellnessSyncState) {
  currentState = next
}

async function setWellnessLastSyncedAt(epochMs: number): Promise<void> {
  try {
    await AsyncStorage.setItem(WELLNESS_LAST_SYNCED_KEY, String(epochMs))
  } catch {
    // ignore
  }
}

// ---------------------------------------------------------------------------
// Retry queue (AsyncStorage-backed) — same backoff as healthkit clinical sync.
// ---------------------------------------------------------------------------

type WellnessPayload = {
  capturedAt: string
  steps: number
  heartRate: number | null
  sleepHours: number | null
}

type QueueEntry = {
  id: string
  payload: WellnessPayload
  attempt: number
  nextAttemptAt: number
  lastError: string | null
}

async function readQueue(): Promise<QueueEntry[]> {
  try {
    const raw = await AsyncStorage.getItem(WELLNESS_QUEUE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as QueueEntry[]) : []
  } catch {
    return []
  }
}

async function writeQueue(q: QueueEntry[]): Promise<void> {
  try {
    await AsyncStorage.setItem(WELLNESS_QUEUE_KEY, JSON.stringify(q))
  } catch {
    // ignore
  }
}

async function enqueueRetry(payload: WellnessPayload, attempt: number, lastError: string): Promise<void> {
  const delay = backoffFor(attempt)
  if (delay === null) {
    console.warn('[WellnessVitals] dropping payload after', attempt, 'attempts:', lastError)
    return
  }
  const q = await readQueue()
  q.push({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    payload,
    attempt,
    nextAttemptAt: Date.now() + delay,
    lastError,
  })
  await writeQueue(q)
  emit({ status: 'retrying', at: Date.now(), attempt: attempt + 1, nextAt: Date.now() + delay })
}

async function postWellness(payload: WellnessPayload): Promise<{ ok: true } | { ok: false; status: number | null; message: string }> {
  try {
    const token = await SecureStore.getItemAsync('cc-session-token').catch(() => null)
    if (!token) return { ok: false, status: 401, message: 'Not authenticated' }
    const headers: Record<string, string> = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }

    const res = await fetch(`${API_BASE}/api/healthkit/wellness`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    })

    if (!res.ok) {
      const text = await res.text().catch(() => '')
      return { ok: false, status: res.status, message: `API error ${res.status}: ${text}` }
    }
    return { ok: true }
  } catch (err) {
    return { ok: false, status: null, message: err instanceof Error ? err.message : String(err) }
  }
}

export async function drainWellnessRetryQueue(): Promise<{ retried: number; succeeded: number }> {
  const q = await readQueue()
  if (q.length === 0) return { retried: 0, succeeded: 0 }
  const now = Date.now()
  const ready = q.filter((e) => e.nextAttemptAt <= now)
  if (ready.length === 0) return { retried: 0, succeeded: 0 }

  const remaining: QueueEntry[] = q.filter((e) => e.nextAttemptAt > now)
  let succeeded = 0

  for (const entry of ready) {
    const result = await postWellness(entry.payload)
    if (result.ok) {
      succeeded += 1
      continue
    }
    const { cls, message } = classifyStatus(result.status, result.message)
    if (cls === 'drop') continue
    if (cls === 'reauth') {
      emit({ status: 'error', at: Date.now(), message: 'Session expired — sign in again', userActionable: true })
      continue
    }
    const nextAttempt = entry.attempt + 1
    const delay = backoffFor(nextAttempt)
    if (delay === null) {
      console.warn('[WellnessVitals] dropping queued payload after', nextAttempt, 'attempts:', message)
      continue
    }
    remaining.push({ ...entry, attempt: nextAttempt, nextAttemptAt: Date.now() + delay, lastError: message })
  }
  await writeQueue(remaining)
  return { retried: ready.length, succeeded }
}

interface NativeWellnessVitals {
  requestAuthorization(): Promise<boolean>
  today(): Promise<WellnessSnapshot>
}

const Bridge: NativeWellnessVitals | null =
  Platform.OS === 'ios' ? (NativeModules.WellnessVitals ?? null) : null

/** Fetch today's wellness snapshot from HealthKit (no network). */
async function readWellnessToday(): Promise<WellnessSnapshot | null> {
  if (!Bridge) return null
  try {
    return await Bridge.today()
  } catch (err) {
    console.warn('[WellnessVitals] today() failed:', err instanceof Error ? err.message : String(err))
    return null
  }
}

/**
 * Read today's wellness and POST to /api/healthkit/wellness. Drains the retry
 * queue first, then posts the fresh snapshot. Returns the OS-facing background
 * fetch classification for the calling task handler.
 */
async function syncWellness(): Promise<'new-data' | 'no-data' | 'failed'> {
  emit({ status: 'syncing' })

  // Opportunistic drain on every invocation.
  await drainWellnessRetryQueue()

  const snap = await readWellnessToday()
  if (!snap) {
    emit({ status: 'idle' })
    return 'no-data'
  }
  if (snap.steps === 0 && snap.heartRate == null && snap.sleepHours == null) {
    emit({ status: 'idle' })
    return 'no-data'
  }

  const payload: WellnessPayload = {
    capturedAt: new Date().toISOString(),
    steps: snap.steps,
    heartRate: snap.heartRate,
    sleepHours: snap.sleepHours,
  }

  const result = await postWellness(payload)
  if (result.ok) {
    const now = Date.now()
    await setWellnessLastSyncedAt(now)
    emit({ status: 'success', at: now })
    return 'new-data'
  }

  const { cls, message } = classifyStatus(result.status, result.message)
  if (cls === 'reauth') {
    emit({ status: 'error', at: Date.now(), message: 'Session expired — sign in again', userActionable: true })
    return 'failed'
  }
  if (cls === 'drop') {
    console.warn('[WellnessVitals] dropping (4xx):', message)
    emit({ status: 'error', at: Date.now(), message: `Backend rejected payload (${result.status ?? '?'})`, userActionable: false })
    return 'failed'
  }
  // 5xx / network — queue for retry.
  await enqueueRetry(payload, 0, message)
  return 'failed'
}

// ---------------------------------------------------------------------------
// 6h background fetch task (independent of clinical-records sync)
// ---------------------------------------------------------------------------

type BgFetchModule = {
  registerTaskAsync: (taskName: string, opts: unknown) => Promise<void>
  unregisterTaskAsync: (taskName: string) => Promise<void>
  BackgroundFetchResult: { NewData: number; NoData: number; Failed: number }
  setMinimumIntervalAsync: (sec: number) => Promise<void>
} | null

type TaskManagerModule = {
  defineTask: (taskName: string, handler: (body: unknown) => Promise<unknown>) => void
  isTaskRegisteredAsync: (taskName: string) => Promise<boolean>
} | null

let bgCached: BgFetchModule | undefined
let tmCached: TaskManagerModule | undefined

function getBg(): BgFetchModule {
  if (bgCached !== undefined) return bgCached
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    bgCached = require('expo-background-fetch') as BgFetchModule
  } catch {
    bgCached = null
  }
  return bgCached
}

function getTm(): TaskManagerModule {
  if (tmCached !== undefined) return tmCached
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    tmCached = require('expo-task-manager') as TaskManagerModule
  } catch {
    tmCached = null
  }
  return tmCached
}

let defined = false
export function defineWellnessTask(): void {
  if (defined) return
  const Tm = getTm()
  const Bg = getBg()
  if (!Tm || !Bg) return
  try {
    Tm.defineTask(WELLNESS_TASK, async () => {
      try {
        const result = await syncWellness()
        if (result === 'new-data') return Bg.BackgroundFetchResult.NewData
        if (result === 'no-data') return Bg.BackgroundFetchResult.NoData
        return Bg.BackgroundFetchResult.Failed
      } catch {
        return Bg.BackgroundFetchResult.Failed
      }
    })
    defined = true
  } catch {
    // ignore
  }
}

export async function registerWellnessBackgroundSync(): Promise<boolean> {
  const Bg = getBg()
  const Tm = getTm()
  if (!Bg || !Tm) return false
  try {
    const already = await Tm.isTaskRegisteredAsync(WELLNESS_TASK)
    if (!already) {
      await Bg.registerTaskAsync(WELLNESS_TASK, {
        minimumInterval: SIX_HOURS_SEC,
        stopOnTerminate: false,
        startOnBoot: true,
      })
    }
    await Bg.setMinimumIntervalAsync(SIX_HOURS_SEC).catch(() => {})
    return true
  } catch {
    return false
  }
}

