/**
 * Error reporting utility
 *
 * Ready for Sentry integration. To enable:
 * 1. npm install @sentry/nextjs
 * 2. Run: npx @sentry/wizard@latest -i nextjs
 * 3. Add SENTRY_DSN to your environment variables
 *
 * Until then, errors are logged to console.
 */

interface ErrorContext {
  component?: string;
  action?: string;
  userId?: string;
  extra?: Record<string, unknown>;
}

export function captureError(error: Error | unknown, context?: ErrorContext) {
  const err = error instanceof Error ? error : new Error(String(error));

  // Always log to console
  console.error(`[Error${context?.component ? ` in ${context.component}` : ''}${context?.action ? ` during ${context.action}` : ''}]`, err.message, context?.extra);

  // Sentry integration (uncomment when ready)
  // if (typeof window !== 'undefined') {
  //   import('@sentry/nextjs').then(Sentry => {
  //     Sentry.captureException(err, {
  //       tags: { component: context?.component, action: context?.action },
  //       user: context?.userId ? { id: context.userId } : undefined,
  //       extra: context?.extra,
  //     });
  //   });
  // }
}

export function captureMessage(message: string, level: 'info' | 'warning' | 'error' = 'info') {
  console.log(`[${level.toUpperCase()}]`, message);

  // Sentry integration (uncomment when ready)
  // import('@sentry/nextjs').then(Sentry => {
  //   Sentry.captureMessage(message, level);
  // });
}
