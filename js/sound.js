// КРИПТОПОЛИС — звук на WebAudio, без аудиофайлов.

const Sound = (() => {
  const PREF = "cryptopolis_sound";
  let ctx = null, ambient = null;
  let enabled = localStorage.getItem(PREF) !== "off";

  function ac() {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  }

  function tone(freq, dur, type = "sine", vol = 0.08, when = 0) {
    if (!enabled) return;
    const c = ac();
    const o = c.createOscillator();
    o.type = type;
    o.frequency.value = freq;
    const g = c.createGain();
    const t = c.currentTime + when;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(c.destination);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  function startAmbient() {
    if (!enabled || ambient) return;
    const c = ac();
    ambient = c.createGain();
    ambient.gain.value = 0;
    ambient.gain.linearRampToValueAtTime(0.025, c.currentTime + 3);
    ambient.connect(c.destination);
    for (const f of [48, 48.6, 96.2]) {
      const o = c.createOscillator();
      o.type = "sine";
      o.frequency.value = f;
      const g = c.createGain();
      g.gain.value = f > 90 ? 0.25 : 0.5;
      o.connect(g).connect(ambient);
      o.start();
    }
  }

  function stopAmbient() {
    if (!ambient) return;
    ambient.gain.linearRampToValueAtTime(0, ac().currentTime + 0.4);
    const a = ambient;
    setTimeout(() => a.disconnect(), 600);
    ambient = null;
  }

  return {
    click()   { tone(620, 0.07, "triangle", 0.05); },
    good()    { tone(523, 0.12, "sine", 0.07); tone(784, 0.18, "sine", 0.07, 0.09); },
    bad()     { tone(196, 0.22, "sawtooth", 0.05); },
    coin()    { tone(988, 0.08, "square", 0.04); tone(1319, 0.14, "square", 0.04, 0.06); },
    fanfare() { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.25, "triangle", 0.08, i * 0.13)); },
    achieve() { tone(880, 0.1, "sine", 0.07); tone(1175, 0.22, "sine", 0.07, 0.1); },
    isEnabled: () => enabled,
    toggle() {
      enabled = !enabled;
      localStorage.setItem(PREF, enabled ? "on" : "off");
      enabled ? startAmbient() : stopAmbient();
      return enabled;
    },
    armOnFirstGesture() {
      const arm = () => { if (enabled) startAmbient(); };
      document.addEventListener("pointerdown", arm, { once: true });
    },
  };
})();
