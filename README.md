# Lava Lamp Playground

WebGL2 metaball / lava-lamp simulator. Vite + React + TypeScript, parametrized live with [DialKit](https://joshpuckett.me/dialkit).

```bash
npm install
npm run dev
```

## How it works

- **Renderer** — a single fragment shader (`src/lava/shaders.ts`) drawn on a fullscreen quad in a `<canvas>` via WebGL2. No Canvas2D.
- **Field** — each blob contributes a metaball influence `r²/dist²`; the color is a **field-weighted average** of the blob colors, so blue + red genuinely blend into lavender at the meeting point (not transparent overlap). A `smoothstep` on the field gives the gooey edge; a wider falloff gives the halo/glow. Grain (per-pixel hash) and a vignette finish it.
- **Motion** (`src/lava/blobs.ts`) — low-frequency sinusoidal drift + vertical buoyancy, computed on the CPU each frame and fed in as `uPos`/`uRadius` uniforms. Slow and viscous by default.
- **Component** (`src/lava/LavaLamp.tsx`) — owns the canvas, GL context, shader program, the `requestAnimationFrame` loop, and the uniforms. Renders at `devicePixelRatio` (capped at 2). Pause freezes accumulated time, not the RAF.
- **Controls** (`src/App.tsx`) — `useDialKit('Lava Lamp', …)` with folders Movimento / Forma / Cor / Textura and the `randomizar` / `pausar` actions. Hex colors are converted to `vec3` before being sent as uniforms. `<DialRoot>` is a sibling of `<LavaLamp>`.

The visual target is `public/reference/frame.png`.
