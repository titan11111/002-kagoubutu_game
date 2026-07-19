/* AudioWorklet: ノイズ／打撃系SEプロセッサ（メインスレッド負荷を下げる） */
class SeNoiseProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this._active = false;
    this._frames = 0;
    this._total = 0;
    this._gain = 0.2;
    this._decay = 0.0008;
    this.port.onmessage = (e) => {
      const d = e.data || {};
      if (d.type === "burst") {
        this._active = true;
        this._frames = 0;
        this._total = Math.max(1, Math.floor((d.duration || 0.4) * sampleRate));
        this._gain = d.gain || 0.25;
        this._decay = d.decay || 0.0009;
      }
    };
  }

  process(_inputs, outputs) {
    const out = outputs[0];
    if (!out || !out[0]) return true;
    const ch0 = out[0];
    const ch1 = out[1] || null;

    for (let i = 0; i < ch0.length; i++) {
      let sample = 0;
      if (this._active) {
        const t = this._frames / this._total;
        const env = Math.max(0, 1 - t);
        // ピンク寄りノイズ（簡易）
        const white = Math.random() * 2 - 1;
        sample = white * env * env * this._gain;
        this._frames += 1;
        if (this._frames >= this._total) this._active = false;
      }
      ch0[i] = sample;
      if (ch1) ch1[i] = sample;
    }
    return true;
  }
}

registerProcessor("se-noise", SeNoiseProcessor);
