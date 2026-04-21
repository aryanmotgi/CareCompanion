type EventName = 'page_view' | 'signup' | 'login' | 'onboarding_step' | 'onboarding_complete' | 'chat_message' | 'feature_used';

interface AnalyticsEvent {
  name: EventName;
  properties?: Record<string, string | number | boolean>;
}

export function trackEvent(event: AnalyticsEvent) {
  // Console logging in development
  if (process.env.NODE_ENV === 'development') {
    console.log('[Analytics]', event.name, event.properties);
  }

  // PostHog integration (uncomment when ready)
  // if (typeof window !== 'undefined' && window.posthog) {
  //   window.posthog.capture(event.name, event.properties);
  // }
}
