// Sound and vibration for scan results, so staff do not have to look at the
// screen for every badge. Success is one short high tone; a problem is two low ones.
//
// Browsers only allow sound after the person has interacted with the page, so
// primeFeedback() is called from a tap or key press before the first scan.
// Vibration works on Android. iPhones do not allow web pages to vibrate.

let ctx = null;

export function primeFeedback() {
  try {
    const Audio = window.AudioContext || window.webkitAudioContext;
    if (!Audio) return;
    if (!ctx) ctx = new Audio();
    if (ctx.state === 'suspended') ctx.resume();
  } catch {
    // No sound available. Vibration and the on-screen message still work.
  }
}

function tone(frequency, startAt, duration) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.value = frequency;
  const t = ctx.currentTime + startAt;
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(0.35, t + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
  osc.connect(gain).connect(ctx.destination);
  osc.start(t);
  osc.stop(t + duration + 0.02);
}

export function signal(ok) {
  try {
    if (navigator.vibrate) navigator.vibrate(ok ? 90 : [70, 70, 70]);
  } catch {
    // Vibration not available.
  }
  try {
    primeFeedback();
    if (!ctx || ctx.state !== 'running') return;
    if (ok) {
      tone(1320, 0, 0.14);
    } else {
      tone(240, 0, 0.16);
      tone(240, 0.22, 0.2);
    }
  } catch {
    // Sound not available.
  }
}
