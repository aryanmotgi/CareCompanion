/**
 * Background fetch wrapper. Lazy-loads expo-background-fetch + expo-task-manager
 * so the app boots fine before the native modules are installed.
 *
 * To enable on device: `npx expo install expo-background-fetch expo-task-manager`
 * then rebuild via `npx expo run:ios --device <udid>`.
 *
 * iOS background fetch fires on the system's discretion (~15min minimum, may be
 * less frequent if the app is rarely opened). It's a best-effort sync, not a
 * guaranteed timer.
 */

export const BACKGROUND_SYNC_TASK = 'cc-background-sync'

type BgFetchModule = {
  registerTaskAsync: (taskName: string, opts: unknown) => Promise<void>
  unregisterTaskAsync: (taskName: string) => Promise<void>
  BackgroundFetchResult: { NewData: number; NoData: number; Failed: number }
  setMinimumIntervalAsync: (sec: number) => Promise<void>
  getStatusAsync: () => Promise<number | null>
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

export function isSupported(): boolean {
  return getBg() !== null && getTm() !== null
}

/**
 * Run-once task definition. Call this at module load so the JS task is
 * registered before any background invocation arrives.
 */
let defined = false
export function defineSyncTask(handler: () => Promise<'new-data' | 'no-data' | 'failed'>): void {
  if (defined) return
  const Tm = getTm()
  const Bg = getBg()
  if (!Tm || !Bg) return
  try {
    Tm.defineTask(BACKGROUND_SYNC_TASK, async () => {
      try {
        const result = await handler()
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

export async function registerBackgroundSync(minIntervalSeconds = 60 * 60): Promise<boolean> {
  const Bg = getBg()
  const Tm = getTm()
  if (!Bg || !Tm) return false
  try {
    const already = await Tm.isTaskRegisteredAsync(BACKGROUND_SYNC_TASK)
    if (!already) {
      await Bg.registerTaskAsync(BACKGROUND_SYNC_TASK, {
        minimumInterval: minIntervalSeconds,
        stopOnTerminate: false,
        startOnBoot: true,
      })
    }
    await Bg.setMinimumIntervalAsync(minIntervalSeconds).catch(() => {})
    return true
  } catch {
    return false
  }
}

export async function unregisterBackgroundSync(): Promise<void> {
  const Bg = getBg()
  if (!Bg) return
  try {
    await Bg.unregisterTaskAsync(BACKGROUND_SYNC_TASK)
  } catch {
    // ignore
  }
}
