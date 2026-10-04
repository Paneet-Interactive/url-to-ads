// score-synth.mjs — procedural background score. Everything is synthesized here from
// oscillators, Karplus-Strong strings, and filtered noise, so the output is fully owned:
// no samples, no model weights, no license attached. Deterministic for a given seed.
//
// renderScore({ duration, cuts, mood, bpm, seed }) → { left, right, sampleRate }
//   duration — seconds; cuts — frame-start times (s) that get a soft swell + low hit.

export const SAMPLE_RATE = 44100;

export const MOODS = {
  // root = MIDI note of the key's tonic (bass octave); chords are [semitones from root, quality]
  mystic: { root: 50, bpm: 84, chords: [[0, "min"], [8, "maj"], [3, "maj"], [10, "maj"]], drums: "soft", arp: "up" },
  warm: { root: 45, bpm: 96, chords: [[0, "maj"], [9, "min"], [5, "maj"], [7, "maj"]], drums: "light", arp: "updown" },
  bright: { root: 48, bpm: 112, chords: [[0, "maj"], [7, "maj"], [9, "min"], [5, "maj"]], drums: "pop", arp: "updown" },
  calm: { root: 53, bpm: 76, chords: [[0, "maj"], [4, "min"], [5, "maj"], [0, "maj"]], drums: "none", arp: "up" },
};

const TRIAD = { maj: [0, 4, 7], min: [0, 3, 7] };
const hz = (midi) => 440 * 2 ** ((midi - 69) / 12);

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function renderScore({ duration, cuts = [], mood = "warm", bpm, seed = 1 }) {
  const m = MOODS[mood];
  if (!m) throw new Error(`unknown mood "${mood}" — ${Object.keys(MOODS).join(", ")}`);
  const sr = SAMPLE_RATE;
  const n = Math.ceil(duration * sr);
  const dryL = new Float32Array(n);
  const dryR = new Float32Array(n);
  const sendL = new Float32Array(n); // reverb send
  const sendR = new Float32Array(n);
  const rand = rng(seed);
  const beat = 60 / (bpm || m.bpm);
  const bar = beat * 4;
  // The last stretch is a held tonic: drums and arpeggio stop, the chord rings out.
  const endHold = Math.min(2.2, duration * 0.18);
  const tEnd = duration - endHold;

  const add = (buf, i, v) => {
    if (i >= 0 && i < n) buf[i] += v;
  };
  const chordAt = (t) => (t >= tEnd ? [0, m.chords[0][1]] : m.chords[Math.floor(t / bar) % m.chords.length]);

  // ── pad: soft additive voices per bar, slow attack, detuned pair for width ──
  const segments = [];
  for (let t = 0; t < tEnd; t += bar) segments.push([t, Math.min(t + bar, tEnd), chordAt(t)]);
  segments.push([tEnd, duration, chordAt(tEnd)]);
  for (const [t0, t1, [deg, q]] of segments) {
    const notes = [...TRIAD[q], 14].map((s) => m.root + 24 + deg + s);
    const att = 0.6;
    const rel = 0.5;
    const last = t1 >= duration - 1e-6;
    const i0 = Math.floor(t0 * sr);
    const i1 = Math.min(n, Math.floor((t1 + (last ? 0 : rel)) * sr));
    notes.forEach((note, k) => {
      for (const [det, panL, panR] of [[-0.004, 0.75, 0.45], [0.004, 0.45, 0.75]]) {
        const f = hz(note) * (1 + det);
        let w = rand() * Math.PI * 2; // phase accumulator: vibrato stays a constant ±0.25%
        for (let i = i0; i < i1; i++) {
          const t = i / sr - t0;
          let env = Math.min(1, t / att);
          if (!last && i / sr > t1) env *= Math.max(0, 1 - (i / sr - t1) / rel);
          const vib = 1 + 0.0025 * Math.sin(2 * Math.PI * 4.8 * t + k);
          w += (2 * Math.PI * f * vib) / sr;
          const v = (Math.sin(w) + 0.28 * Math.sin(2 * w) + 0.1 * Math.sin(3 * w)) * env * 0.032;
          dryL[i] += v * panL;
          dryR[i] += v * panR;
          sendL[i] += v * panL * 0.8;
          sendR[i] += v * panR * 0.8;
        }
      }
    });
  }

  // ── bass: sine + a little second harmonic on beats 1 and 3 ──
  for (let t = 0, b = 0; t < duration - 0.05; t += beat, b++) {
    if (b % 4 !== 0 && b % 4 !== 2 && !(m.drums === "pop" && b % 4 === 3)) continue;
    const [deg] = chordAt(t);
    const f = hz(m.root + deg - (deg > 6 ? 12 : 0));
    const len = t >= tEnd ? duration - t : beat * 1.6;
    const i0 = Math.floor(t * sr);
    for (let i = 0; i < len * sr; i++) {
      const tt = i / sr;
      const env = Math.min(1, tt / 0.006) * Math.exp(-tt / (t >= tEnd ? 1.2 : 0.38));
      const w = 2 * Math.PI * f * tt;
      const v = (Math.sin(w) + 0.25 * Math.sin(2 * w)) * env * 0.14;
      add(dryL, i0 + i, v);
      add(dryR, i0 + i, v);
    }
    if (t >= tEnd) break;
  }

  // ── pluck arpeggio: Karplus-Strong strings, 8th notes (quarters in the first bar) ──
  const step = beat / 2;
  let a = 0;
  for (let t = 0; t < tEnd - 0.05; t += step, a++) {
    if (t < bar && a % 2 === 1) continue;
    const [deg, q] = chordAt(t);
    const tones = [...TRIAD[q], 12, 7 + 12];
    const order = m.arp === "up" ? tones : [...tones, ...tones.slice(1, -1).reverse()];
    const note = m.root + 36 + deg + order[a % order.length] - (deg > 6 ? 12 : 0);
    const f = hz(note);
    const N = Math.max(2, Math.round(sr / f));
    const ring = new Float32Array(N);
    for (let k = 0; k < N; k++) ring[k] = rand() * 2 - 1;
    const vel = 0.07 * (0.8 + 0.4 * rand());
    const pan = a % 2 ? 0.35 : -0.35;
    const i0 = Math.floor(t * sr);
    const len = Math.floor(1.3 * sr);
    let prev = 0;
    for (let i = 0; i < len; i++) {
      const k = i % N;
      const cur = ring[k];
      ring[k] = 0.996 * 0.5 * (cur + prev);
      prev = cur;
      const v = cur * vel * Math.min(1, i / 40);
      add(dryL, i0 + i, v * (1 - pan) * 0.7);
      add(dryR, i0 + i, v * (1 + pan) * 0.7);
      add(sendL, i0 + i, v * 0.6);
      add(sendR, i0 + i, v * 0.6);
    }
  }

  // ── drums: kick (sine sweep), hats (high-passed noise), snare for "pop" ──
  if (m.drums !== "none") {
    for (let t = 0, b = 0; t < tEnd - 0.05; t += beat, b++) {
      const kickOn = m.drums === "soft" ? b % 4 === 0 : b % 2 === 0;
      if (kickOn) {
        const i0 = Math.floor(t * sr);
        let ph = 0;
        for (let i = 0; i < 0.32 * sr; i++) {
          const tt = i / sr;
          const f = 45 + 70 * Math.exp(-tt / 0.03);
          ph += (2 * Math.PI * f) / sr;
          const v = Math.sin(ph) * Math.exp(-tt / 0.13) * (m.drums === "soft" ? 0.17 : 0.24);
          add(dryL, i0 + i, v);
          add(dryR, i0 + i, v);
        }
      }
      if (m.drums === "pop" && b % 4 === 1 || m.drums === "pop" && b % 4 === 3) {
        const i0 = Math.floor(t * sr);
        let lp = 0;
        for (let i = 0; i < 0.18 * sr; i++) {
          const x = rand() * 2 - 1;
          lp += 0.35 * (x - lp);
          const v = (x - lp) * Math.exp(-(i / sr) / 0.05) * 0.06;
          add(dryL, i0 + i, v);
          add(dryR, i0 + i, v);
          add(sendL, i0 + i, v * 0.5);
          add(sendR, i0 + i, v * 0.5);
        }
      }
      if (m.drums !== "soft") {
        const i0 = Math.floor((t + beat / 2) * sr);
        let lp = 0;
        for (let i = 0; i < 0.04 * sr; i++) {
          const x = rand() * 2 - 1;
          lp += 0.6 * (x - lp);
          const v = (x - lp) * Math.exp(-(i / sr) / 0.012) * 0.03;
          add(dryL, i0 + i, v * 0.8);
          add(dryR, i0 + i, v);
        }
      }
    }
  }

  // ── cut accents: a short filtered-noise swell into each cut, then a soft low hit ──
  for (const c of cuts) {
    if (c <= 0.05 || c >= duration - 0.1) continue;
    const sw = 0.5;
    const i0 = Math.floor((c - sw) * sr);
    let lp = 0;
    for (let i = 0; i < sw * sr; i++) {
      const p = i / (sw * sr);
      const x = rand() * 2 - 1;
      lp += (0.02 + 0.25 * p) * (x - lp);
      const v = lp * p ** 2.5 * 0.12;
      add(sendL, i0 + i, v);
      add(sendR, i0 + i, v);
      add(dryL, i0 + i, v * 0.5);
      add(dryR, i0 + i, v * 0.5);
    }
    const j0 = Math.floor(c * sr);
    for (let i = 0; i < 0.5 * sr; i++) {
      const tt = i / sr;
      const v = Math.sin(2 * Math.PI * (38 + 30 * Math.exp(-tt / 0.06)) * tt) * Math.exp(-tt / 0.18) * 0.16;
      add(dryL, j0 + i, v);
      add(dryR, j0 + i, v);
    }
  }

  // ── reverb: small Schroeder network on the send bus (combs → allpasses), per channel ──
  const reverb = (input, offset) => {
    const out = new Float32Array(n);
    for (const d of [1116, 1188, 1277, 1356].map((x) => x + offset)) {
      const buf = new Float32Array(d);
      let k = 0;
      let lp = 0;
      for (let i = 0; i < n; i++) {
        const y = buf[k];
        lp = y * 0.75 + lp * 0.25;
        buf[k] = input[i] + lp * 0.8;
        out[i] += y * 0.25;
        k = (k + 1) % d;
      }
    }
    for (const d of [556 + offset, 441 + offset]) {
      const buf = new Float32Array(d);
      let k = 0;
      for (let i = 0; i < n; i++) {
        const b = buf[k];
        const x = out[i];
        buf[k] = x + b * 0.5;
        out[i] = b - x * 0.5;
        k = (k + 1) % d;
      }
    }
    return out;
  };
  const wetL = reverb(sendL, 0);
  const wetR = reverb(sendR, 23);

  // ── master: sum, gentle saturation, fades, normalize to -1 dBFS ──
  const left = new Float32Array(n);
  const right = new Float32Array(n);
  const fadeIn = 0.02 * sr;
  const fadeOut = Math.min(1.4, duration * 0.12) * sr;
  let peak = 0;
  for (let i = 0; i < n; i++) {
    let g = 1;
    if (i < fadeIn) g = i / fadeIn;
    if (i > n - fadeOut) g *= Math.max(0, (n - i) / fadeOut) ** 1.5;
    left[i] = Math.tanh((dryL[i] + wetL[i] * 0.35) * 1.4) * g;
    right[i] = Math.tanh((dryR[i] + wetR[i] * 0.35) * 1.4) * g;
    peak = Math.max(peak, Math.abs(left[i]), Math.abs(right[i]));
  }
  const norm = peak > 0 ? 0.89 / peak : 1;
  for (let i = 0; i < n; i++) {
    left[i] *= norm;
    right[i] *= norm;
  }
  return { left, right, sampleRate: sr };
}

// 16-bit PCM stereo WAV.
export function encodeWav({ left, right, sampleRate }) {
  const n = left.length;
  const buf = Buffer.alloc(44 + n * 4);
  buf.write("RIFF", 0);
  buf.writeUInt32LE(36 + n * 4, 4);
  buf.write("WAVE", 8);
  buf.write("fmt ", 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(2, 22);
  buf.writeUInt32LE(sampleRate, 24);
  buf.writeUInt32LE(sampleRate * 4, 28);
  buf.writeUInt16LE(4, 32);
  buf.writeUInt16LE(16, 34);
  buf.write("data", 36);
  buf.writeUInt32LE(n * 4, 40);
  for (let i = 0; i < n; i++) {
    buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, left[i])) * 32767), 44 + i * 4);
    buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, right[i])) * 32767), 46 + i * 4);
  }
  return buf;
}
