// Sound and vibration for scan results, so staff do not have to look at the
// screen for every badge. Success is a rising three-note chime; a problem is
// two low, falling notes.
//
// Browsers only allow sound after the person has interacted with the page, so
// primeFeedback() is called from a tap or key press before the first scan.
// Vibration works on Android. iPhones do not allow web pages to vibrate, and
// they mute web page sound while the ring switch is set to silent.

let ctx = null;
let output = null;

export function primeFeedback() {
  try {
    const Audio = window.AudioContext || window.webkitAudioContext;
    if (!Audio) return;
    if (!ctx) {
      ctx = new Audio();
      // A compressor lets the chime play loud without distorting.
      output = ctx.createDynamicsCompressor();
      output.threshold.value = -10;
      output.ratio.value = 6;
      output.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume();
  } catch {
    // No sound available. The on-screen message still works.
  }
}

// One bell-like note: a tone plus a quieter octave above it, fading out.
function note(frequency, startAt, duration, type = 'sine') {
  const t = ctx.currentTime + startAt;
  [[frequency, 0.9], [frequency * 2, 0.25]].forEach(([freq, level]) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(level, t + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    osc.connect(gain).connect(output);
    osc.start(t);
    osc.stop(t + duration + 0.05);
  });
}

export function signal(ok) {
  try {
    if (navigator.vibrate) navigator.vibrate(ok ? [120, 60, 180] : [200, 100, 200, 100, 200]);
  } catch {
    // Vibration not available.
  }
  try {
    primeFeedback();
    if (!ctx || ctx.state !== 'running') return;
    if (ok) {
      note(880, 0, 0.5);
      note(1174.66, 0.14, 0.55);
      note(1567.98, 0.28, 0.9);
    } else {
      note(311.13, 0, 0.45, 'triangle');
      note(233.08, 0.3, 0.8, 'triangle');
    }
  } catch {
    // Sound not available.
  }
}
