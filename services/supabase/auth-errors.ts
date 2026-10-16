/**
 * Maps Supabase auth errors (and our own) to i18n keys, so screens never show
 * raw English server messages.
 */

export class SyncNotConfiguredError extends Error {
  constructor() {
    super('Sync is not configured for this build');
    this.name = 'SyncNotConfiguredError';
  }
}

const CODE_TO_KEY: Record<string, string> = {
  invalid_credentials: 'auth.errors.invalidCredentials',
  email_not_confirmed: 'auth.errors.emailNotConfirmed',
  user_already_exists: 'auth.errors.emailInUse',
  email_exists: 'auth.errors.emailInUse',
  weak_password: 'auth.errors.weakPassword',
  over_request_rate_limit: 'auth.errors.rateLimited',
  over_email_send_rate_limit: 'auth.errors.rateLimited',
  signup_disabled: 'auth.errors.signupDisabled',
  email_provider_disabled: 'auth.errors.signupDisabled',
  email_address_invalid: 'errors.emailInvalid',
};

export function getAuthErrorKey(error: unknown): string {
  if (error instanceof SyncNotConfiguredError) return 'auth.errors.notConfigured';

  const err = (error ?? {}) as { code?: unknown; name?: unknown; status?: unknown; message?: unknown };
  if (typeof err.code === 'string' && CODE_TO_KEY[err.code]) {
    return CODE_TO_KEY[err.code];
  }
  const message = typeof err.message === 'string' ? err.message : '';
  if (
    err.name === 'AuthRetryableFetchError' ||
    err.status === 0 ||
    /network request failed|failed to fetch|network error/i.test(message)
  ) {
    return 'errors.networkError';
  }
  // Older GoTrue servers send no `code`; fall back to the well-known messages.
  if (/invalid login credentials/i.test(message)) return 'auth.errors.invalidCredentials';
  if (/email not confirmed/i.test(message)) return 'auth.errors.emailNotConfirmed';
  if (/already registered|already exists/i.test(message)) return 'auth.errors.emailInUse';
  return 'errors.generic';
}

/** Maps the English messages from utils/validators to i18n keys. */
const VALIDATION_TO_KEY: Record<string, string> = {
  'Email is required': 'errors.emailRequired',
  'Invalid email': 'errors.emailInvalid',
  'Password is required': 'errors.passwordRequired',
  'Password must be at least 6 characters': 'errors.passwordTooShort',
  'Name is required': 'errors.nameRequired',
  'Name is too long': 'errors.nameTooLong',
};

export function getValidationErrorKey(message: string): string {
  return VALIDATION_TO_KEY[message] ?? 'errors.generic';
}
