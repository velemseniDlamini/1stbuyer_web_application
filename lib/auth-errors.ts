// Plain-language auth errors.
//
// The product rule: never show a user a provider message or an infrastructure
// detail. "AuthApiError: Invalid login credentials" and "email rate limit
// exceeded" tell a buyer nothing and tell an attacker something.
//
// Sign-in failures deliberately collapse to ONE message. Distinguishing "no
// such account" from "wrong password" turns the form into an account-existence
// oracle.

export const SIGN_IN_FAILED = 'That email and password combination is not recognised.'

export type AuthFailure = {
  message: string
  /** True when retrying immediately cannot help, so the UI can say so. */
  terminal: boolean
}

export function describeSignInError(raw: string | null | undefined): AuthFailure {
  const text = (raw ?? '').toLowerCase()

  if (text.includes('rate limit') || text.includes('too many')) {
    return {
      message: 'Too many attempts in a short time. Wait a few minutes and try again.',
      terminal: false,
    }
  }
  if (text.includes('email not confirmed')) {
    return {
      message: 'This account has not been activated yet. Contact support if that seems wrong.',
      terminal: true,
    }
  }
  if (text.includes('fetch') || text.includes('network')) {
    return {
      message: 'We could not reach the server. Check your connection and try again.',
      terminal: false,
    }
  }
  return { message: SIGN_IN_FAILED, terminal: false }
}

export function describeSignUpError(raw: string | null | undefined): AuthFailure {
  const text = (raw ?? '').toLowerCase()

  if (text.includes('already registered') || text.includes('already been registered') || text.includes('exists')) {
    return {
      message: 'There is already an account with that email address. Try signing in instead.',
      terminal: true,
    }
  }
  if (text.includes('invalid') && text.includes('email')) {
    return {
      message: 'That email address was rejected. Check it for typos and use a real address.',
      terminal: true,
    }
  }
  if (text.includes('password')) {
    return {
      message: 'That password is too weak. Use at least 8 characters.',
      terminal: true,
    }
  }
  if (text.includes('rate limit') || text.includes('too many')) {
    return {
      message: 'Too many sign-ups from here in a short time. Wait a few minutes and try again.',
      terminal: false,
    }
  }
  if (text.includes('fetch') || text.includes('network')) {
    return {
      message: 'We could not reach the server. Check your connection and try again.',
      terminal: false,
    }
  }
  return { message: 'We could not create the account. Try again in a moment.', terminal: false }
}

/** Local validation, run before a request is made. */
export function validateCredentials(email: string, password: string): string | null {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return 'Enter a valid email address.'
  if (password.length < 8) return 'Password must be at least 8 characters.'
  return null
}
