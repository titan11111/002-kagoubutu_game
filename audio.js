// Web Audio + AudioWorklet + SpeechSynthesis（mp3不要・iOSはジェスチャ後にunlock）
const Sound = (() => {
  let ctx = null;
  let muted = localStorage.getItem("kagoubutu_mute") === "1";
  let unlocked = false;
  let workletReady = false;
  let workletNode = null;
  let workletGain = null;

  function getCtx() {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    return ctx;
  }

  async function setupWorklet() {
    const c = getCtx();
    if (workletReady || !c.audioWorklet) return;
    try {
      await c.audioWorklet.addModule(new URL("se-worklet.js", window.location.href).href);
      workletNode = new AudioWorkletNode(c, "se-noise");
      workletGain = c.createGain();
      workletGain.gain.value = 1;
      workletNode.connect(workletGain);
      workletGain.connect(c.destination);
      workletReady = true;
    } catch (_) {
      workletReady = false;
      workletNode = null;
    }
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
    await setupWorklet();
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

  function noiseBurstFallback(dur, vol = 0.25) {
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

  function noiseBurst(dur, vol = 0.25) {
    if (muted || !unlocked) return;
    if (workletReady && workletNode) {
      workletNode.port.postMessage({
        type: "burst",
        duration: dur,
        gain: vol,
        decay: 0.001,
      });
      return;
    }
    noiseBurstFallback(dur, vol);
  }

  function pinpon() {
    // 少し厚めの正解チャイム
    beep(880, 0.12, "sine", 0.11, 0);
    beep(880 * 2, 0.08, "triangle", 0.04, 0.02);
    beep(1175, 0.18, "sine", 0.12, 0.14);
    beep(1175 * 2, 0.1, "triangle", 0.035, 0.16);
    beep(880, 0.12, "sine", 0.1, 0.36);
    beep(1175, 0.22, "sine", 0.12, 0.5);
    beep(1568, 0.16, "sine", 0.06, 0.62);
  }

  function tick() {
    beep(1200, 0.04, "square", 0.05);
  }

  function jan() {
    beep(523, 0.08, "triangle", 0.1, 0);
    beep(784, 0.12, "triangle", 0.1, 0.08);
    beep(1047, 0.18, "triangle", 0.12, 0.18);
    beep(1319, 0.1, "sine", 0.05, 0.28);
  }

  function explode() {
    if (muted || !unlocked) return;
    beep(60, 0.55, "sawtooth", 0.22, 0);
    beep(40, 0.75, "square", 0.16, 0.05);
    beep(90, 0.35, "sawtooth", 0.1, 0.12);
    noiseBurst(0.95, 0.38);
    setTimeout(() => noiseBurst(0.55, 0.3), 110);
    setTimeout(() => beep(70, 0.45, "sawtooth", 0.14), 180);
    setTimeout(() => noiseBurst(0.4, 0.22), 320);
    setTimeout(() => noiseBurst(0.25, 0.15), 480);
  }

  function tap() {
    beep(640, 0.028, "square", 0.045);
    beep(980, 0.02, "triangle", 0.025, 0.015);
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

  function usingWorklet() {
    return workletReady;
  }

  return { unlock, pinpon, tick, jan, explode, tap, speak, setMuted, isMuted, usingWorklet };
})();
