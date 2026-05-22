'use client';

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { CareGroupScreen } from './CareGroupScreen';
import { OnboardingProfilePicker, type PickerProfile } from './OnboardingProfilePicker';
import { DisclaimerModal } from './onboarding/DisclaimerModal';
import { WelcomeCarousel } from './onboarding/WelcomeCarousel';
import { RolePicker } from './onboarding/RolePicker';
import { HealthConsent } from './onboarding/HealthConsent';
import { OnboardingRecords } from './onboarding/OnboardingRecords';
import { HealthConnect } from './onboarding/HealthConnect';
import { ShareInvite } from './onboarding/ShareInvite';
import { CareGroupJoin } from './onboarding/CareGroupJoin';
import { CareRelationship } from './onboarding/CareRelationship';
import { JoinedToast } from './onboarding/JoinedToast';
import { IosAppBanner } from './onboarding/IosAppBanner';
import { useSession } from 'next-auth/react';
import { initialState, reducer, canGoBack, type Role } from '@/lib/onboarding/phase-machine';
import { clearDraft, loadDraft, saveDraft } from '@/lib/onboarding/auto-save';
import { onboardingAnalytics } from '@/lib/analytics/onboarding-events';

const OnboardingWizard = dynamic(
  () => import('@/components/OnboardingWizard').then((m) => m.OnboardingWizard),
  { ssr: false }
);

interface ShellProfile {
  id: string;
  patientName: string | null;
  patientAge: number | null;
  cancerType: string | null;
  cancerStage: string | null;
  treatmentPhase: string | null;
  relationship: string | null;
  onboardingCompleted: boolean | null;
  onboardingPriorities: string[] | null;
}

interface OnboardingShellProps {
  allProfiles: ShellProfile[];
  userName: string;
  userEmail: string;
  userAvatar: string;
  userRole?: Role | null;
  initialCareGroupId?: string;
  inviteError?: string;
}

const POLL_INTERVAL_MS = 3_000;

export function OnboardingShell({
  allProfiles,
  userName,
  userEmail,
  userRole: userRoleProp,
  initialCareGroupId,
  inviteError,
}: OnboardingShellProps) {
  // Existing-user fast paths
  const completedProfiles = allProfiles.filter((p) => p.onboardingCompleted === true);
  const hasCompleted = completedProfiles.length > 0;
  const incomplete = allProfiles.find((p) => !p.onboardingCompleted);

  // Profile picker: multi-profile returning users get to choose which one to edit/add
  const [pickedProfileId, setPickedProfileId] = useState<string | null | undefined>(
    allProfiles.length === 1 ? allProfiles[0].id : undefined,
  );
  const shouldShowPicker = hasCompleted && allProfiles.length > 1 && pickedProfileId === undefined;
  const pickerProfiles: PickerProfile[] = allProfiles.map((p) => ({
    id: p.id,
    patientName: p.patientName,
    cancerType: p.cancerType,
    relationship: p.relationship,
    onboardingCompleted: p.onboardingCompleted,
  }));

  // Returning users who completed onboarding never see the new flow — drop them
  // straight into wizard for editing or skip entirely if already in a group.
  const skipToWizard = hasCompleted || Boolean(initialCareGroupId);

  const activeProfile: ShellProfile | null = useMemo(() => {
    if (incomplete) return incomplete;
    return null;
  }, [incomplete]);

  const derivedRole = useMemo<Role | null>(() => {
    if (userRoleProp != null) return userRoleProp;
    const rel = activeProfile?.relationship;
    if (rel === 'self') return 'self';
    if (rel === 'caregiver') return 'caregiver';
    if (rel === 'patient') return 'patient';
    return null;
  }, [userRoleProp, activeProfile?.relationship]);

  const [state, dispatch] = useReducer(
    reducer,
    null,
    () =>
      initialState({
        role: derivedRole,
        careGroupId: initialCareGroupId ?? null,
        careProfileId: activeProfile?.id ?? null,
        startAt: skipToWizard ? 'role' : 'disclaimer',
      })
  );

  // Hydrate from localStorage draft on mount
  const hydrated = useRef(false);
  useEffect(() => {
    if (hydrated.current) return;
    hydrated.current = true;
    if (skipToWizard) return;
    const draft = loadDraft();
    if (!draft) return;
    // Stale draft: server says user has no role yet but draft jumped past role pick.
    // Discard so the role phase isn't skipped after a re-signup.
    if (derivedRole == null && draft.role != null) {
      clearDraft();
      return;
    }
    dispatch({ type: 'HYDRATE', state: draft });
    onboardingAnalytics.resumed(draft.phase.kind);
  }, [skipToWizard, derivedRole]);

  // Persist draft on every state change (debounced)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (state.phase.kind === 'complete') {
      clearDraft();
      return;
    }
    if (state.phase.kind === 'disclaimer') return; // pre-acceptance: nothing to save
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => saveDraft(state), 400);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [state]);

  // Fire phase-entered analytics whenever phase kind changes
  const prevPhaseKind = useRef<string>(state.phase.kind);
  useEffect(() => {
    if (prevPhaseKind.current !== state.phase.kind) {
      onboardingAnalytics.phaseEntered(state.phase.kind, state.role ?? undefined);
      prevPhaseKind.current = state.phase.kind;
    }
  }, [state.phase.kind, state.role]);

  // Live presence: poll status when on share-invite phase
  const [joinedName, setJoinedName] = useState<string | null>(null);
  const [toastVisible, setToastVisible] = useState(false);
  useEffect(() => {
    if (state.phase.kind !== 'share-invite') return;
    if (!state.careGroupId) return;
    let cancelled = false;
    const interval = window.setInterval(async () => {
      try {
        const r = await fetch(`/api/care-group/${state.careGroupId}/status`, { credentials: 'include' });
        if (!r.ok) return;
        const data = await r.json() as { joined?: boolean; name?: string };
        if (!cancelled && data.joined && !toastVisible) {
          setJoinedName(data.name ?? null);
          setToastVisible(true);
          onboardingAnalytics.joinedToastShown(Boolean(data.name));
        }
      } catch {
        // ignore poll error
      }
    }, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [state.phase.kind, state.careGroupId, toastVisible]);

  // Profile creation when user becomes patient/self post role pick (if none exists)
  const createProfileIfNeeded = useCallback(async (): Promise<string | null> => {
    if (state.careProfileId) return state.careProfileId;
    try {
      const r = await fetch('/api/care-profiles', { method: 'POST', credentials: 'include' });
      const data = await r.json() as { id?: string };
      if (data.id) {
        dispatch({ type: 'SET_PROFILE', careProfileId: data.id });
        return data.id;
      }
    } catch {
      // ignore — wizard will surface error
    }
    return null;
  }, [state.careProfileId]);

  // Onboarding completion: clear draft, fire analytics, refresh JWT, redirect
  const { data: session, update: updateSession } = useSession();
  const onboardingStart = useRef<number>(Date.now());
  useEffect(() => {
    if (state.phase.kind !== 'complete') return;
    const total = Date.now() - onboardingStart.current;
    onboardingAnalytics.completed(state.role ?? 'unknown', total, state.skipped);
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem('onboarding_just_completed', 'true');
      window.localStorage.removeItem('welcome_banner_dismissed');
    } catch { /* private browsing */ }
    clearDraft();
    // Refresh JWT from DB so middleware sees current role before /dashboard nav.
    // Without this, a session whose cookie predates the role pick (e.g. resumed-from-draft)
    // gets bounced back to /onboarding on the very next request.
    (async () => {
      try { await updateSession(); } catch { /* network hiccup — middleware will recover via DB re-read on next request */ }
      window.location.href = '/dashboard';
    })();
  }, [state.phase.kind, state.role, state.skipped, updateSession]);

  // ===== Render by phase =====

  // Multi-profile returning user picks which profile to work on
  if (shouldShowPicker) {
    return (
      <OnboardingProfilePicker
        profiles={pickerProfiles}
        onSelect={setPickedProfileId}
      />
    );
  }

  // Returning-completed user: render legacy wizard directly
  if (skipToWizard) {
    const wizardProfileId = activeProfile?.id ?? null;
    if (!wizardProfileId) {
      return <LegacyCareGroupFallback userName={userName} userEmail={userEmail} userRole={derivedRole ?? 'patient'} />;
    }
    return (
      <OnboardingWizard
        careProfileId={wizardProfileId}
        userRole={derivedRole}
        careGroupId={state.careGroupId ?? undefined}
        onComplete={() => { window.location.href = '/dashboard'; }}
      />
    );
  }

  const errorBanner = inviteError ? (
    <div
      role="alert"
      className="mx-auto mb-4 max-w-md rounded-xl px-4 py-3"
      style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}
    >
      <p className="text-xs" style={{ color: 'var(--rose)' }}>{inviteError}</p>
    </div>
  ) : null;

  const showBack = canGoBack(state.phase);

  return (
    <>
      {errorBanner}
      <IosAppBanner role={state.role} />

      {showBack && (
        <button
          type="button"
          onClick={() => dispatch({ type: 'BACK' })}
          aria-label="Go back"
          className="fixed left-4 top-4 z-50 flex h-10 w-10 items-center justify-center rounded-full transition-all duration-150 active:scale-95"
          style={{
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.12)',
            backdropFilter: 'blur(12px)',
            color: 'var(--text, #EDE9FE)',
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
      )}

      {state.phase.kind === 'disclaimer' && (
        <DisclaimerModal onAccepted={() => dispatch({ type: 'DISMISS_DISCLAIMER' })} />
      )}

      {state.phase.kind === 'welcome' && (
        <WelcomeCarousel
          startSceneIdx={state.phase.sceneIdx}
          onFinish={() => dispatch({ type: 'WELCOME_FINISH' })}
        />
      )}

      {state.phase.kind === 'role' && (
        <RolePicker
          careProfileId={state.careProfileId}
          onSelected={async (r) => {
            // Ensure profile exists for patient/self path before continuing
            if (r !== 'caregiver') {
              await createProfileIfNeeded();
            }
            dispatch({ type: 'SELECT_ROLE', role: r });
          }}
        />
      )}

      {state.phase.kind === 'consent' && (
        <HealthConsent onAccepted={() => dispatch({ type: 'ACCEPT_CONSENT' })} />
      )}

      {state.phase.kind === 'records' && (
        <OnboardingRecords
          onConnect={() => dispatch({ type: 'PICK_RECORDS_CONNECT' })}
          onSkip={() => dispatch({ type: 'PICK_RECORDS_SKIP' })}
        />
      )}

      {state.phase.kind === 'health-connect' && (
        <HealthConnect onContinue={() => dispatch({ type: 'HEALTH_CONNECT_DONE' })} />
      )}

      {state.phase.kind === 'care-group-join' && (
        <CareGroupJoin
          onJoined={(patientName) => dispatch({ type: 'JOIN_BY_CODE_OK', patientName })}
        />
      )}

      {state.phase.kind === 'care-relationship' && (
        <CareRelationship
          patientName={state.phase.patientName}
          onConfirmed={() => dispatch({ type: 'CONFIRM_RELATIONSHIP' })}
        />
      )}

      {state.phase.kind === 'wizard' && state.careProfileId && (
        <OnboardingWizard
          careProfileId={state.careProfileId}
          userRole={state.role}
          careGroupId={state.careGroupId ?? undefined}
          isAppReview={session?.user?.email === 'appreview@carecompanionai.org'}
          onComplete={() => dispatch({ type: 'COMPLETE_WIZARD' })}
        />
      )}

      {state.phase.kind === 'wizard' && !state.careProfileId && (
        <ProfileCreatingLoader />
      )}

      {state.phase.kind === 'share-invite' && (
        <>
          {/* Patient/self path lands here after wizard. We need a careGroupId to display a code,
              so if missing, transparently surface the existing CareGroupScreen which both creates
              the group and registers the user. */}
          {state.careGroupId ? (
            <ShareInvite
              careGroupId={state.careGroupId}
              patientName={activeProfile?.patientName ?? userName}
              onContinue={() => dispatch({ type: 'DISMISS_SHARE_INVITE' })}
              onSkip={() => dispatch({ type: 'DISMISS_SHARE_INVITE' })}
            />
          ) : (
            <CareGroupScreen
              userRole={(state.role ?? 'patient') as 'patient' | 'caregiver' | 'self'}
              userDisplayName={userName || userEmail.split('@')[0] || 'You'}
              onComplete={(cgId) => {
                if (cgId) dispatch({ type: 'SET_CARE_GROUP', careGroupId: cgId });
              }}
            />
          )}
          {toastVisible ? (
            <JoinedToast joinerName={joinedName} onDismiss={() => setToastVisible(false)} />
          ) : null}
        </>
      )}

      {state.phase.kind === 'complete' && <CompleteLoader />}
    </>
  );
}

function ProfileCreatingLoader() {
  return (
    <div className="flex min-h-[60svh] items-center justify-center">
      <span
        className="h-6 w-6 animate-spin rounded-full border-2"
        style={{ borderColor: 'var(--border)', borderTopColor: 'var(--accent)' }}
        aria-label="Setting up your profile"
      />
    </div>
  );
}

function CompleteLoader() {
  return (
    <div className="flex min-h-[100svh] items-center justify-center" style={{ background: 'var(--bg)' }}>
      <span
        className="h-6 w-6 animate-spin rounded-full border-2"
        style={{ borderColor: 'var(--border)', borderTopColor: 'var(--accent)' }}
        aria-label="Finishing up"
      />
    </div>
  );
}

function LegacyCareGroupFallback({ userName, userEmail, userRole }: { userName: string; userEmail: string; userRole: 'patient' | 'caregiver' | 'self' }) {
  return (
    <CareGroupScreen
      userRole={userRole}
      userDisplayName={userName || userEmail.split('@')[0] || 'You'}
      onComplete={() => { window.location.href = '/dashboard'; }}
    />
  );
}
