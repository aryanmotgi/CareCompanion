// Phase machine for /onboarding. Discriminated union + reducer.
// Phases mirror mobile (apps/mobile/app/*.tsx). Web orchestrator is OnboardingShell.

export type Role = 'patient' | 'caregiver' | 'self';

type Phase =
  | { kind: 'disclaimer' }
  | { kind: 'welcome'; sceneIdx: number }
  | { kind: 'role' }
  | { kind: 'consent' }
  | { kind: 'records' }
  | { kind: 'health-connect' }
  | { kind: 'wizard'; step: number }
  | { kind: 'care-group-join'; mode: 'code' | 'email' }
  | { kind: 'care-relationship'; patientName: string | null }
  | { kind: 'share-invite' }
  | { kind: 'complete' };

export interface PhaseState {
  phase: Phase;
  role: Role | null;
  careGroupId: string | null;
  careProfileId: string | null;
  phaseEnteredAt: number;
  /** Phases the user actively skipped (recorded for analytics). */
  skipped: string[];
}

type PhaseAction =
  | { type: 'DISMISS_DISCLAIMER' }
  | { type: 'WELCOME_NEXT_SCENE' }
  | { type: 'WELCOME_FINISH' }
  | { type: 'SELECT_ROLE'; role: Role }
  | { type: 'ACCEPT_CONSENT' }
  | { type: 'PICK_RECORDS_CONNECT' }
  | { type: 'PICK_RECORDS_SKIP' }
  | { type: 'HEALTH_CONNECT_DONE' }
  | { type: 'WIZARD_STEP_NEXT' }
  | { type: 'WIZARD_STEP_PREV' }
  | { type: 'COMPLETE_WIZARD' }
  | { type: 'JOIN_BY_CODE_OK'; patientName: string | null }
  | { type: 'SWITCH_JOIN_MODE'; mode: 'code' | 'email' }
  | { type: 'CONFIRM_RELATIONSHIP' }
  | { type: 'DISMISS_SHARE_INVITE' }
  | { type: 'SET_CARE_GROUP'; careGroupId: string }
  | { type: 'SET_PROFILE'; careProfileId: string }
  | { type: 'HYDRATE'; state: PhaseState };

const NUM_WELCOME_SCENES = 4;

export function initialState(opts: {
  role?: Role | null;
  careGroupId?: string | null;
  careProfileId?: string | null;
  startAt?: Phase['kind'];
}): PhaseState {
  const startKind = opts.startAt ?? 'disclaimer';
  let phase: Phase = { kind: 'disclaimer' };
  if (startKind === 'welcome') phase = { kind: 'welcome', sceneIdx: 0 };
  else if (startKind === 'role') phase = { kind: 'role' };
  return {
    phase,
    role: opts.role ?? null,
    careGroupId: opts.careGroupId ?? null,
    careProfileId: opts.careProfileId ?? null,
    phaseEnteredAt: Date.now(),
    skipped: [],
  };
}

export function reducer(state: PhaseState, action: PhaseAction): PhaseState {
  const now = Date.now();
  const enter = (phase: Phase): PhaseState => ({ ...state, phase, phaseEnteredAt: now });

  switch (action.type) {
    case 'HYDRATE':
      return action.state;

    case 'DISMISS_DISCLAIMER':
      if (state.phase.kind !== 'disclaimer') return state;
      return enter({ kind: 'welcome', sceneIdx: 0 });

    case 'WELCOME_NEXT_SCENE': {
      if (state.phase.kind !== 'welcome') return state;
      const next = state.phase.sceneIdx + 1;
      if (next >= NUM_WELCOME_SCENES) return enter({ kind: 'role' });
      return { ...state, phase: { kind: 'welcome', sceneIdx: next } };
    }

    case 'WELCOME_FINISH':
      return enter({ kind: 'role' });

    case 'SELECT_ROLE': {
      const nextPhase: Phase =
        action.role === 'caregiver'
          ? { kind: 'care-group-join', mode: 'code' }
          : { kind: 'consent' };
      return { ...enter(nextPhase), role: action.role };
    }

    case 'ACCEPT_CONSENT':
      if (state.phase.kind !== 'consent') return state;
      return enter({ kind: 'records' });

    case 'PICK_RECORDS_CONNECT':
      if (state.phase.kind !== 'records') return state;
      return enter({ kind: 'health-connect' });

    case 'PICK_RECORDS_SKIP':
      if (state.phase.kind !== 'records') return state;
      return { ...enter({ kind: 'wizard', step: 0 }), skipped: [...state.skipped, 'records'] };

    case 'HEALTH_CONNECT_DONE':
      return enter({ kind: 'wizard', step: 0 });

    case 'WIZARD_STEP_NEXT': {
      if (state.phase.kind !== 'wizard') return state;
      return { ...state, phase: { kind: 'wizard', step: state.phase.step + 1 } };
    }

    case 'WIZARD_STEP_PREV': {
      if (state.phase.kind !== 'wizard') return state;
      const prev = Math.max(0, state.phase.step - 1);
      return { ...state, phase: { kind: 'wizard', step: prev } };
    }

    case 'COMPLETE_WIZARD':
      if (state.phase.kind !== 'wizard') return state;
      if (state.role === 'patient' || state.role === 'self') {
        return enter({ kind: 'share-invite' });
      }
      return enter({ kind: 'complete' });

    case 'SWITCH_JOIN_MODE':
      if (state.phase.kind !== 'care-group-join') return state;
      return { ...state, phase: { kind: 'care-group-join', mode: action.mode } };

    case 'JOIN_BY_CODE_OK':
      return enter({ kind: 'care-relationship', patientName: action.patientName });

    case 'CONFIRM_RELATIONSHIP':
      return enter({ kind: 'complete' });

    case 'DISMISS_SHARE_INVITE':
      return enter({ kind: 'complete' });

    case 'SET_CARE_GROUP':
      return { ...state, careGroupId: action.careGroupId };

    case 'SET_PROFILE':
      return { ...state, careProfileId: action.careProfileId };

    default:
      return state;
  }
}
