// WebGL2 (GLSL ES 3.00) shaders for the metaball / lava-lamp field.

export const MAX_BLOBS = 6;

export const VERT_SRC = /* glsl */ `#version 300 es
// Fullscreen triangle/quad. Position comes in clip space directly.
layout(location = 0) in vec2 aPos;
void main() {
  gl_Position = vec4(aPos, 0.0, 1.0);
}
`;

export const FRAG_SRC = /* glsl */ `#version 300 es
precision highp float;

#define MAX_BLOBS ${MAX_BLOBS}

out vec4 fragColor;

uniform vec2  uResolution;
uniform float uTime;

uniform int   uCount;
uniform vec2  uPos[MAX_BLOBS];     // normalized [0,1], y up
uniform float uRadius[MAX_BLOBS];  // fraction of height
uniform vec3  uColor[MAX_BLOBS];   // linear-ish rgb

uniform vec3  uBg;
uniform float uThreshold;   // field threshold (fusao / gooeyness)
uniform float uEdge;        // smoothstep half-width (suavidade)
uniform float uGlow;        // halo intensity
uniform float uSaturation;
uniform float uContrast;
uniform float uGrain;
uniform float uGrainScale;
uniform float uVignette;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}

vec3 satAdjust(vec3 c, float s) {
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  return mix(vec3(l), c, s);
}

void main() {
  vec2 res = uResolution;
  float aspect = res.x / res.y;

  // st in [0,1], y up.
  vec2 st = gl_FragCoord.xy / res;

  float field = 0.0;
  vec3  colSum = vec3(0.0);

  for (int i = 0; i < MAX_BLOBS; i++) {
    if (i >= uCount) break;
    vec2 d = st - uPos[i];
    d.x *= aspect;                 // keep blobs circular regardless of viewport
    float r = uRadius[i];
    float w = (r * r) / (dot(d, d) + 1e-4);  // metaball influence ~ r^2/dist^2
    field  += w;
    colSum += w * uColor[i];
  }

  // Weighted-average color: blue + red -> lavender at the meeting point.
  vec3 blended = colSum / max(field, 1e-4);

  // Mass: gooey edge via smoothstep on the field.
  float mask = smoothstep(uThreshold - uEdge, uThreshold + uEdge, field);

  // Halo / glow: a tight luminous fringe just outside the mass, falling off
  // fast so the dark field reads as black rather than a colored wash.
  float halo = smoothstep(uThreshold * 0.55, uThreshold, field);
  halo *= halo;

  vec3 col = mix(uBg, blended, mask);
  col += blended * halo * uGlow * (1.0 - mask);  // add light only outside the core

  // saturation / contrast
  col = satAdjust(col, uSaturation);
  col = (col - 0.5) * uContrast + 0.5;

  // film grain (per-pixel hash, lightly animated)
  float g = (hash(st * res * (uGrainScale * 0.01) + fract(uTime) * 100.0) - 0.5) * uGrain;
  col += g;

  // vignette
  vec2 vd = st - 0.5;
  float v = 1.0 - uVignette * dot(vd, vd) * 2.0;
  col *= v;

  fragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
`;
