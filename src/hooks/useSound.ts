import { useCallback, useEffect, useRef } from "react";

export type SoundName = "deal" | "flip" | "chip" | "win" | "blackjack" | "lose" | "push";

type Ctx = AudioContext;

/* ---------- tiny synth primitives ---------- */

function tone(
  ctx: Ctx,
  frequency: number,
  { start = 0, duration = 0.16, gain = 0.05, type = "sine" as OscillatorType, glide }: {
    start?: number;
    duration?: number;
    gain?: number;
    type?: OscillatorType;
    glide?: number;
  } = {},
) {
  const t0 = ctx.currentTime + start;
  const osc = ctx.createOscillator();
  const amp = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(frequency, t0);
  if (glide) osc.frequency.exponentialRampToValueAtTime(glide, t0 + duration);
  amp.gain.setValueAtTime(0.0001, t0);
  amp.gain.exponentialRampToValueAtTime(gain, t0 + 0.012);
  amp.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
  osc.connect(amp).connect(ctx.destination);
  osc.start(t0);
  osc.stop(t0 + duration + 0.02);
}

let noiseBuffer: AudioBuffer | null = null;

function noise(
  ctx: Ctx,
  { start = 0, duration = 0.09, gain = 0.06, frequency = 1800, q = 0.9 }: {
    start?: number;
    duration?: number;
    gain?: number;
    frequency?: number;
    q?: number;
  } = {},
) {
  if (!noiseBuffer || noiseBuffer.sampleRate !== ctx.sampleRate) {
    const length = ctx.sampleRate; // one second of white noise, reused
    noiseBuffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
  }
  const t0 = ctx.currentTime + start;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer;
  const filter = ctx.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = frequency;
  filter.Q.value = q;
  const amp = ctx.createGain();
  amp.gain.setValueAtTime(0.0001, t0);
  amp.gain.exponentialRampToValueAtTime(gain, t0 + 0.015);
  amp.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
  src.connect(filter).connect(amp).connect(ctx.destination);
  src.start(t0, Math.random() * 0.5);
  src.stop(t0 + duration + 0.02);
}

/* ---------- sound design ---------- */

const SOUNDS: Record<SoundName, (ctx: Ctx) => void> = {
  deal: (ctx) => {
    noise(ctx, { duration: 0.1, frequency: 2200, gain: 0.05 });
    tone(ctx, 900, { start: 0.04, duration: 0.03, gain: 0.012, type: "triangle" });
  },
  flip: (ctx) => {
    noise(ctx, { duration: 0.12, frequency: 1400, gain: 0.045 });
    noise(ctx, { start: 0.1, duration: 0.07, frequency: 2600, gain: 0.03 });
  },
  chip: (ctx) => {
    tone(ctx, 1900, { duration: 0.045, gain: 0.03, type: "triangle" });
    tone(ctx, 2600, { start: 0.02, duration: 0.04, gain: 0.018, type: "sine" });
  },
  win: (ctx) => {
    tone(ctx, 523.25, { duration: 0.22, gain: 0.04 });
    tone(ctx, 659.25, { start: 0.11, duration: 0.24, gain: 0.04 });
    tone(ctx, 783.99, { start: 0.22, duration: 0.34, gain: 0.04 });
  },
  blackjack: (ctx) => {
    tone(ctx, 523.25, { duration: 0.2, gain: 0.04 });
    tone(ctx, 659.25, { start: 0.1, duration: 0.2, gain: 0.04 });
    tone(ctx, 783.99, { start: 0.2, duration: 0.2, gain: 0.04 });
    tone(ctx, 1046.5, { start: 0.3, duration: 0.5, gain: 0.045 });
  },
  lose: (ctx) => {
    tone(ctx, 220, { duration: 0.32, gain: 0.045, glide: 160 });
  },
  push: (ctx) => {
    tone(ctx, 440, { duration: 0.2, gain: 0.035 });
  },
};

/**
 * Lightweight procedural sound effects via the Web Audio API — no assets.
 * The context is created lazily on first use so autoplay policies are satisfied.
 */
export function useSound(enabled: boolean) {
  const ctxRef = useRef<AudioContext | null>(null);
  const enabledRef = useRef(enabled);

  useEffect(() => {
    enabledRef.current = enabled;
  }, [enabled]);

  useEffect(() => {
    return () => {
      ctxRef.current?.close().catch(() => undefined);
    };
  }, []);

  return useCallback((name: SoundName) => {
    if (!enabledRef.current) return;
    try {
      if (!ctxRef.current) {
        const AudioCtor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!AudioCtor) return;
        ctxRef.current = new AudioCtor();
      }
      const ctx = ctxRef.current;
      if (ctx.state === "suspended") ctx.resume().catch(() => undefined);
      SOUNDS[name](ctx);
    } catch {
      /* audio is strictly decorative */
    }
  }, []);
}
