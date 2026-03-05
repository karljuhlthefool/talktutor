/**
 * Trial Gating Utilities
 * Limits free voice sessions to 1-2 minutes without login
 */

// Toggle to enable/disable trial mode
// Set to false to require login for all usage
export const TRIAL_ENABLED = false;

const TRIAL_LIMIT_SECONDS = 90; // 1.5 minutes
const TRIAL_STORAGE_KEY = 'talktutor_trial';

export interface TrialState {
  isTrial: boolean;
  used: boolean;
  remaining: number; // seconds
  expired: boolean;
}

export function getTrialState(): TrialState {
  // If trial is disabled, always return as used/expired
  if (!TRIAL_ENABLED) {
    return { isTrial: false, used: true, remaining: 0, expired: true };
  }

  if (typeof window === 'undefined') {
    return { isTrial: false, used: false, remaining: 0, expired: false };
  }

  const trialStart = localStorage.getItem(TRIAL_STORAGE_KEY);
  const trialUsed = localStorage.getItem(`${TRIAL_STORAGE_KEY}_used`);

  if (!trialStart && !trialUsed) {
    return { isTrial: false, used: false, remaining: 0, expired: false };
  }

  const elapsed = trialStart ? (Date.now() - parseInt(trialStart)) / 1000 : 0;
  const remaining = Math.max(0, TRIAL_LIMIT_SECONDS - elapsed);
  const expired = remaining <= 0;

  return {
    isTrial: true,
    used: trialUsed === 'true',
    remaining,
    expired,
  };
}

export function startTrial(): void {
  localStorage.setItem(TRIAL_STORAGE_KEY, Date.now().toString());
}

export function endTrial(): void {
  localStorage.setItem(`${TRIAL_STORAGE_KEY}_used`, 'true');
  localStorage.removeItem(TRIAL_STORAGE_KEY);
}

export function resetTrial(): void {
  localStorage.removeItem(TRIAL_STORAGE_KEY);
  localStorage.removeItem(`${TRIAL_STORAGE_KEY}_used`);
}

// Check if user can start a trial session
export function canStartTrial(): boolean {
  const trial = getTrialState();
  return !trial.used && !trial.expired;
}

// Check if trial is currently active
export function isTrialActive(): boolean {
  const trial = getTrialState();
  return trial.isTrial && !trial.expired && !trial.used;
}
