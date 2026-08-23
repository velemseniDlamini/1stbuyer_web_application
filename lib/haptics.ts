// Haptics, feature-detected, reduced-motion aware, never throws.
//
// A light tick on add, a distinct double-pulse on remove. Anything more is a
// gimmick; anything unguarded is a crash on a desktop browser.

const ADD_PATTERN = 10
const REMOVE_PATTERN = [20, 30, 20]

function allowed(): boolean {
  if (typeof window === 'undefined') return false
  if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return false
  // A user who asked for less motion did not ask for buzzing either.
  return !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
}

function fire(pattern: number | number[]) {
  if (!allowed()) return
  try {
    navigator.vibrate(pattern)
  } catch {
    /* vibration is a nicety; a failure must never surface */
  }
}

export function hapticAdd() {
  fire(ADD_PATTERN)
}

export function hapticRemove() {
  fire(REMOVE_PATTERN)
}
