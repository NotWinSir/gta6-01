// Every sound in Coral Bay Heat is synthesised with WebAudio at run time: there are no audio
// files. An engine hum that follows the throttle, a two-tone siren that swells as a police
// car closes in, gunshots, crashes, cash pickups, mission jingles and a slow tropical bass
// loop for the music. The context is created on the first user gesture, as browsers require;
// before that, and in headless screenshot runs, every call is a safe no-op.
export function createAudio() {
  let ctx = null;
  let master = null;
  let engine = null;
  let siren = null;
  let musicOn = false;
  let musicTimer = null;
  let musicStep = 0;

  function unlock() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      return;
    }
    try {
      const Ctor = window.AudioContext || window.webkitAudioContext;
      if (!Ctor) return;
      ctx = new Ctor();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
    } catch {
      ctx = null;
    }
  }

  function noiseBuffer() {
    const length = ctx.sampleRate * 0.5;
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = Math.random() * 2 - 1;
    return buffer;
  }
  let sharedNoise = null;
  function noise() {
    if (!sharedNoise) sharedNoise = noiseBuffer();
    return sharedNoise;
  }

  function blip(freqFrom, freqTo, seconds, type, gainValue, when = 0) {
    if (!ctx) return;
    const t = ctx.currentTime + when;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freqFrom, t);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, freqTo), t + seconds);
    gain.gain.setValueAtTime(gainValue, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + seconds);
    osc.connect(gain).connect(master);
    osc.start(t);
    osc.stop(t + seconds + 0.02);
  }

  function noiseHit(seconds, filterFreq, gainValue, when = 0) {
    if (!ctx) return;
    const t = ctx.currentTime + when;
    const source = ctx.createBufferSource();
    source.buffer = noise();
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(gainValue, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + seconds);
    source.connect(filter).connect(gain).connect(master);
    source.start(t);
    source.stop(t + seconds + 0.02);
  }

  /** Start or stop the engine hum; throttle 0..1 and speed 0..1 shape its pitch and growl. */
  function setEngine(running, throttle, speed) {
    if (!ctx) return;
    if (!running) {
      if (engine) {
        engine.gain.gain.setTargetAtTime(0, ctx.currentTime, 0.08);
        const old = engine;
        window.setTimeout(() => {
          try {
            old.osc.stop();
            old.sub.stop();
          } catch { /* already stopped */ }
        }, 300);
        engine = null;
      }
      return;
    }
    if (!engine) {
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      const sub = ctx.createOscillator();
      sub.type = 'square';
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 420;
      const gain = ctx.createGain();
      gain.gain.value = 0;
      osc.connect(filter);
      sub.connect(filter);
      filter.connect(gain).connect(master);
      osc.start();
      sub.start();
      engine = { osc, sub, gain, filter };
    }
    const rpm = 50 + speed * 130 + throttle * 40;
    engine.osc.frequency.setTargetAtTime(rpm, ctx.currentTime, 0.05);
    engine.sub.frequency.setTargetAtTime(rpm / 2, ctx.currentTime, 0.05);
    engine.filter.frequency.setTargetAtTime(300 + throttle * 700 + speed * 300, ctx.currentTime, 0.05);
    engine.gain.gain.setTargetAtTime(0.05 + throttle * 0.05, ctx.currentTime, 0.06);
  }

  /** The police siren: level 0 silences it, 1 is a car on your bumper. */
  function setSiren(level) {
    if (!ctx) return;
    if (level <= 0.01) {
      if (siren) {
        siren.gain.gain.setTargetAtTime(0, ctx.currentTime, 0.1);
        const old = siren;
        window.setTimeout(() => {
          try {
            old.osc.stop();
            old.lfo.stop();
          } catch { /* already stopped */ }
        }, 350);
        siren = null;
      }
      return;
    }
    if (!siren) {
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.value = 820;
      const lfo = ctx.createOscillator();
      lfo.type = 'square';
      lfo.frequency.value = 0.9;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 130;
      lfo.connect(lfoGain).connect(osc.frequency);
      const gain = ctx.createGain();
      gain.gain.value = 0;
      osc.connect(gain).connect(master);
      osc.start();
      lfo.start();
      siren = { osc, lfo, gain };
    }
    siren.gain.gain.setTargetAtTime(0.012 + level * 0.05, ctx.currentTime, 0.1);
  }

  /** A slow sun-soaked bass loop: eight steps, triangle bass over a soft noise hat. */
  function setMusic(on) {
    if (!ctx) return;
    if (on === musicOn) return;
    musicOn = on;
    if (!on) {
      if (musicTimer) window.clearInterval(musicTimer);
      musicTimer = null;
      return;
    }
    const bassline = [110, 0, 110, 131.85, 0, 98, 0, 146.83];
    musicTimer = window.setInterval(() => {
      if (!ctx || !musicOn) return;
      const note = bassline[musicStep % bassline.length];
      if (note) blip(note, note * 0.99, 0.32, 'triangle', 0.16);
      if (musicStep % 2 === 0) noiseHit(0.03, 6000, 0.012);
      musicStep += 1;
    }, 240);
  }

  return {
    unlock,
    setEngine,
    setSiren,
    setMusic,
    get musicOn() {
      return musicOn;
    },
    click() {
      blip(660, 440, 0.07, 'square', 0.08);
    },
    shot() {
      noiseHit(0.12, 1800, 0.5);
      blip(220, 60, 0.1, 'square', 0.3);
    },
    dryFire() {
      blip(1200, 900, 0.03, 'square', 0.1);
    },
    thud() {
      noiseHit(0.09, 500, 0.35);
    },
    crash(strength) {
      noiseHit(0.28, 900, Math.min(0.7, 0.25 + strength * 0.5));
      blip(140, 40, 0.25, 'sawtooth', 0.3);
    },
    scrape() {
      noiseHit(0.15, 2600, 0.12);
    },
    honk() {
      blip(370, 370, 0.18, 'square', 0.07);
      blip(466, 466, 0.18, 'square', 0.05);
    },
    pickup() {
      blip(880, 880, 0.07, 'sine', 0.2);
      blip(1318, 1318, 0.1, 'sine', 0.2, 0.07);
    },
    cash() {
      blip(1046, 1046, 0.08, 'square', 0.12);
      blip(1568, 1568, 0.14, 'square', 0.12, 0.08);
    },
    doorSlam() {
      noiseHit(0.08, 700, 0.3);
      blip(120, 70, 0.08, 'sine', 0.25);
    },
    success() {
      blip(523, 523, 0.12, 'triangle', 0.22);
      blip(659, 659, 0.12, 'triangle', 0.22, 0.11);
      blip(784, 784, 0.22, 'triangle', 0.24, 0.22);
    },
    fail() {
      blip(392, 392, 0.16, 'triangle', 0.2);
      blip(311, 311, 0.16, 'triangle', 0.2, 0.15);
      blip(233, 180, 0.3, 'triangle', 0.2, 0.3);
    },
    busted() {
      blip(220, 110, 0.5, 'sawtooth', 0.25);
      noiseHit(0.4, 800, 0.2, 0.05);
    },
    phoneRing() {
      blip(1046, 1046, 0.12, 'sine', 0.15);
      blip(1046, 1046, 0.12, 'sine', 0.15, 0.2);
    },
  };
}
