// Blob field state + per-frame motion (slow, viscous drift + vertical buoyancy).

import { MAX_BLOBS } from './shaders';

export type Blob = {
  baseX: number;
  baseY: number;
  fx: number; // horizontal drift freq
  fy: number; // orbital drift freq
  fb: number; // buoyancy freq
  ph: number;
  ph2: number;
  sizeJitter: number; // -1..1
  colorIndex: number; // 0,1,2 -> palette A,B,C
};

// Small deterministic PRNG so reseed(seed) is reproducible.
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const TAU = Math.PI * 2;

export function makeBlobs(count: number, seed: number): Blob[] {
  const n = Math.max(2, Math.min(MAX_BLOBS, Math.round(count)));
  const rng = mulberry32(seed * 2654435761 + 1);
  const blobs: Blob[] = [];
  for (let i = 0; i < n; i++) {
    // Spread around center: far enough apart that only 2 blobs meet in any
    // region (so colors stay saturated and the dark field shows through),
    // but close enough that drift makes them cross and merge into capsules.
    const angle = (i / n) * TAU + (rng() - 0.5) * 1.0;
    const dist = 0.22 + rng() * 0.1;
    blobs.push({
      baseX: 0.5 + Math.cos(angle) * dist,
      baseY: 0.5 + Math.sin(angle) * dist,
      fx: 0.1 + rng() * 0.22,
      fy: 0.1 + rng() * 0.22,
      fb: 0.08 + rng() * 0.14,
      ph: rng() * TAU,
      ph2: rng() * TAU,
      sizeJitter: rng() * 2 - 1,
      colorIndex: i % 3,
    });
  }
  return blobs;
}

export type MotionParams = {
  wander: number; // vagar
  buoyancy: number; // flutuacao
  size: number; // tamanho (base radius)
  variation: number; // variacao
};

// Writes positions/radii into the provided flat arrays for the uniforms.
export function updateBlobs(
  blobs: Blob[],
  t: number,
  p: MotionParams,
  posOut: Float32Array, // length MAX_BLOBS * 2
  radiusOut: Float32Array, // length MAX_BLOBS
) {
  for (let i = 0; i < blobs.length; i++) {
    const b = blobs[i];
    const x = b.baseX + Math.sin(t * b.fx + b.ph) * p.wander;
    const y =
      b.baseY +
      Math.cos(t * b.fy + b.ph2) * p.wander +
      Math.sin(t * b.fb) * p.buoyancy;
    posOut[i * 2] = x;
    posOut[i * 2 + 1] = y;
    const r = p.size * (1 + b.sizeJitter * p.variation * 0.5);
    radiusOut[i] = Math.max(0.02, r);
  }
}
