// Audio engine (design section 5).
//
// Milestone 1 only creates the shared AudioContext. Browsers allow audio to
// start only after a click or key press (a gamepad button does not count), so
// the start screen calls unlockAudio() from such an event (7.1).

let context = null;

/** Returns the shared AudioContext, or null before unlockAudio() was called. */
export function getAudioContext() {
  return context;
}

/**
 * Creates the AudioContext if needed and resumes it. Must be called from a
 * click or key press handler. Resolves to the context (or null if Web Audio
 * is unavailable).
 */
export async function unlockAudio() {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) {
    console.warn('Web Audio API is not available in this browser.');
    return null;
  }
  if (!context) context = new AudioContextClass({ latencyHint: 'interactive' });
  if (context.state === 'suspended') {
    try {
      await context.resume();
    } catch (err) {
      console.warn('Could not resume the AudioContext', err);
    }
  }
  return context;
}

/**
 * Resumes the context again on later clicks or key presses, in case the
 * browser suspended it (e.g. after the tab was in the background).
 */
export function keepAudioAlive() {
  const resume = () => {
    if (context && context.state === 'suspended') context.resume().catch(() => {});
  };
  window.addEventListener('pointerdown', resume, true);
  window.addEventListener('keydown', resume, true);
}
