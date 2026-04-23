import * as Sentry from '@sentry/nextjs'
import { scrubPHI } from '@/lib/sentry-utils'

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 0.1,
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 0,
  beforeSend: scrubPHI,
})
