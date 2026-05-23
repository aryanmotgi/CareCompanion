// Onboarding funnel events → internal analytics_events table (Aurora) +
// Vercel Analytics for traffic counts. No third-party processor sees PHI.
import { track } from '@vercel/analytics';
import { trackClientEvent } from '@/lib/analytics-client';

type Role = 'patient' | 'caregiver' | 'self' | 'unknown';

function emit(name: string, props: Record<string, string | number | boolean>) {
  try {
    track(name, props);
  } catch {
    /* analytics never blocks user flow */
  }
  trackClientEvent({ eventName: name, properties: props });
}

export const onboardingAnalytics = {
  phaseEntered(phase: string, role?: Role) {
    emit('onboarding.phase_entered', { phase, role: role ?? 'unknown' });
  },
  phaseCompleted(phase: string, role: Role, durationMs: number) {
    emit('onboarding.phase_completed', { phase, role, durationMs });
  },
  errored(phase: string, code: string, role?: Role) {
    emit('onboarding.error', { phase, code, role: role ?? 'unknown' });
  },
  completed(role: Role, totalMs: number, skippedSteps: string[]) {
    emit('onboarding.completed', { role, totalMs, skippedSteps: skippedSteps.join(',') });
  },
  joinedToastShown(hasName: boolean) {
    emit('onboarding.joined_toast_shown', { hasName });
  },
  resumed(phase: string) {
    emit('onboarding.resumed', { phase });
  },
};
