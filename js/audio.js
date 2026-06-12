// ПЕРЕПИСЬ — звук. Чистый WebAudio, без файлов:
// низкий гул бумажного собора и шелест страницы на каждом выборе.

const PerepisAudio = (() => {
  const PREF_KEY = "perepis_sound";
  let ctx = null;
  let ambientGain = null;
  let enabled = localStorage.getItem(PREF_KEY) !== "off";

  function ensureCtx() {
    if (!ctx) {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  }

  function noiseBuffer(seconds) {
    const c = ensureCtx();
    const buf = c.createBuffer(1, c.sampleRate * seconds, c.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    return buf;
  }

  function startAmbient() {
    if (!enabled || ambientGain) return;
    const c = ensureCtx();

    ambientGain = c.createGain();
    ambientGain.gain.value = 0;
    ambientGain.gain.linearRampToValueAtTime(0.05, c.currentTime + 4);
    ambientGain.connect(c.destination);

    // два расстроенных низких тона — гул под полом зала Сведения
    for (const freq of [54, 54.7]) {
      const osc = c.createOscillator();
      osc.type = "sine";
      osc.frequency.value = freq;
      const g = c.createGain();
      g.gain.value = 0.5;
      osc.connect(g).connect(ambientGain);
      osc.start();
    }

    // дыхание бумаги: зацикленный шум через узкий фильтр
    const src = c.createBufferSource();
    src.buffer = noiseBuffer(4);
    src.loop = true;
    const filter = c.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = 320;
    filter.Q.value = 8;
    const g = c.createGain();
    g.gain.value = 0.18;
    // медленное колыхание громкости шума
    const lfo = c.createOscillator();
    lfo.frequency.value = 0.07;
    const lfoGain = c.createGain();
    lfoGain.gain.value = 0.1;
    lfo.connect(lfoGain).connect(g.gain);
    lfo.start();
    src.connect(filter).connect(g).connect(ambientGain);
    src.start();
  }

  function stopAmbient() {
    if (!ambientGain) return;
    const c = ensureCtx();
    ambientGain.gain.linearRampToValueAtTime(0, c.currentTime + 0.5);
    const dying = ambientGain;
    setTimeout(() => dying.disconnect(), 700);
    ambientGain = null;
  }

  function page() {
    if (!enabled) return;
    const c = ensureCtx();
    const src = c.createBufferSource();
    src.buffer = noiseBuffer(0.25);
    const filter = c.createBiquadFilter();
    filter.type = "highpass";
    filter.frequency.value = 1800;
    const g = c.createGain();
    g.gain.setValueAtTime(0.12, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.22);
    src.connect(filter).connect(g).connect(c.destination);
    src.start();
  }

  function toggle() {
    enabled = !enabled;
    localStorage.setItem(PREF_KEY, enabled ? "on" : "off");
    if (enabled) startAmbient();
    else stopAmbient();
    return enabled;
  }

  return {
    page,
    toggle,
    isEnabled: () => enabled,
    // браузеры разрешают звук только после жеста пользователя
    armOnFirstGesture() {
      const arm = () => { if (enabled) startAmbient(); };
      document.addEventListener("pointerdown", arm, { once: true });
      document.addEventListener("keydown", arm, { once: true });
    },
  };
})();
