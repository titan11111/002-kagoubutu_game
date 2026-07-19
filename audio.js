// Web Audio + SpeechSynthesis（mp3不要・iOSはジェスチャ後にunlock）
const Sound = (() => {
  let ctx = null;
  let muted = localStorage.getItem("kagoubutu_mute") === "1";
  let unlocked = false;

  function getCtx() {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    return ctx;
  }

  async function unlock() {
    const c = getCtx();
    if (c.state === "suspended") await c.resume();
    const buf = c.createBuffer(1, 1, 22050);
    const src = c.createBufferSource();
    src.buffer = buf;
    src.connect(c.destination);
    src.start(0);
    unlocked = true;
  }

  function beep(freq, dur, type = "square", vol = 0.08, when = 0) {
    if (muted || !unlocked) return;
    const c = getCtx();
    const t0 = c.currentTime + when;
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(gain);
    gain.connect(c.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  function noiseBurst(dur, vol = 0.25) {
    if (muted || !unlocked) return;
    const c = getCtx();
    const len = Math.floor(c.sampleRate * dur);
    const buf = c.createBuffer(1, len, c.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    }
    const src = c.createBufferSource();
    const gain = c.createGain();
    const filter = c.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 800;
    src.buffer = buf;
    gain.gain.setValueAtTime(vol, c.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + dur);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(c.destination);
    src.start();
  }

  function pinpon() {
    beep(880, 0.12, "sine", 0.12, 0);
    beep(1175, 0.18, "sine", 0.12, 0.14);
    beep(880, 0.12, "sine", 0.1, 0.36);
    beep(1175, 0.22, "sine", 0.12, 0.5);
  }

  function tick() {
    beep(1200, 0.04, "square", 0.05);
  }

  function jan() {
    beep(523, 0.08, "triangle", 0.1, 0);
    beep(784, 0.12, "triangle", 0.1, 0.08);
    beep(1047, 0.18, "triangle", 0.12, 0.18);
  }

  function explode() {
    if (muted || !unlocked) return;
    const c = getCtx();
    // 低音ドーン
    beep(60, 0.5, "sawtooth", 0.2, 0);
    beep(40, 0.7, "square", 0.15, 0.05);
    noiseBurst(0.9, 0.35);
    // 二次爆発
    setTimeout(() => noiseBurst(0.5, 0.28), 120);
    setTimeout(() => beep(80, 0.4, "sawtooth", 0.12), 200);
    setTimeout(() => noiseBurst(0.35, 0.2), 350);
  }

  function tap() {
    beep(600, 0.03, "square", 0.04);
  }

  function speak(text, rate = 1.15) {
    if (muted || !window.speechSynthesis) return;
    try {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = "ja-JP";
      u.rate = rate;
      u.pitch = 1.1;
      u.volume = 1;
      window.speechSynthesis.speak(u);
    } catch (_) { /* ignore */ }
  }

  function setMuted(v) {
    muted = v;
    localStorage.setItem("kagoubutu_mute", v ? "1" : "0");
    if (v && window.speechSynthesis) window.speechSynthesis.cancel();
  }

  function isMuted() {
    return muted;
  }

  return { unlock, pinpon, tick, jan, explode, tap, speak, setMuted, isMuted };
})();
