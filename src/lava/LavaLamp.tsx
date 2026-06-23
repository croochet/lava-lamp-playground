import { useEffect, useRef } from 'react';
import { FRAG_SRC, VERT_SRC, MAX_BLOBS } from './shaders';
import { makeBlobs, updateBlobs, type Blob } from './blobs';
import { hexToVec3 } from './color';

export type LavaParams = {
  // Movimento
  velocidade: number;
  vagar: number;
  flutuacao: number;
  // Forma
  blobs: number;
  tamanho: number;
  variacao: number;
  fusao: number;
  suavidade: number;
  glow: number;
  // Cor
  fundo: string;
  corA: string;
  corB: string;
  corC: string;
  saturacao: number;
  contraste: number;
  // Textura
  grao: number;
  escalaGrao: number;
  vinheta: number;
};

type Props = {
  params: LavaParams;
  seed: number;
  paused: boolean;
};

function compileShader(gl: WebGL2RenderingContext, type: number, src: string) {
  const sh = gl.createShader(type)!;
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(sh);
    gl.deleteShader(sh);
    throw new Error(`Shader compile error: ${log}`);
  }
  return sh;
}

export default function LavaLamp({ params, seed, paused }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Latest props read by the RAF loop without re-creating the loop.
  const paramsRef = useRef(params);
  paramsRef.current = params;
  const pausedRef = useRef(paused);
  pausedRef.current = paused;

  // Blob set; regenerated whenever seed or blob count changes.
  const blobsRef = useRef<Blob[]>(makeBlobs(params.blobs, seed));
  useEffect(() => {
    blobsRef.current = makeBlobs(paramsRef.current.blobs, seed);
  }, [seed, params.blobs]);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const gl = canvas.getContext('webgl2', {
      antialias: true,
      premultipliedAlpha: false,
    });
    if (!gl) {
      // eslint-disable-next-line no-console
      console.error('WebGL2 not available');
      return;
    }

    // --- program ---
    const vs = compileShader(gl, gl.VERTEX_SHADER, VERT_SRC);
    const fs = compileShader(gl, gl.FRAGMENT_SHADER, FRAG_SRC);
    const prog = gl.createProgram()!;
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      throw new Error(`Program link error: ${gl.getProgramInfoLog(prog)}`);
    }
    gl.useProgram(prog);

    // --- fullscreen quad (two triangles) ---
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    // prettier-ignore
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
      -1, -1,  1, -1,  -1, 1,
      -1,  1,  1, -1,   1, 1,
    ]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

    // --- uniform locations ---
    const U = (name: string) => gl.getUniformLocation(prog, name);
    const uResolution = U('uResolution');
    const uTime = U('uTime');
    const uCount = U('uCount');
    const uPos = U('uPos');
    const uRadius = U('uRadius');
    const uColor = U('uColor');
    const uBg = U('uBg');
    const uThreshold = U('uThreshold');
    const uEdge = U('uEdge');
    const uGlow = U('uGlow');
    const uSaturation = U('uSaturation');
    const uContrast = U('uContrast');
    const uGrain = U('uGrain');
    const uGrainScale = U('uGrainScale');
    const uVignette = U('uVignette');

    // scratch buffers
    const posArr = new Float32Array(MAX_BLOBS * 2);
    const radArr = new Float32Array(MAX_BLOBS);
    const colArr = new Float32Array(MAX_BLOBS * 3);

    // --- resize to devicePixelRatio (cap 2) ---
    let cssW = 0;
    let cssH = 0;
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      if (w === cssW && h === cssH) return;
      cssW = w;
      cssH = h;
      canvas.width = Math.max(1, Math.round(w * dpr));
      canvas.height = Math.max(1, Math.round(h * dpr));
      gl.viewport(0, 0, canvas.width, canvas.height);
    };
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    resize();

    // --- loop ---
    let raf = 0;
    let last = performance.now();
    let simTime = 0; // accumulated, scaled by velocidade

    const render = (now: number) => {
      raf = requestAnimationFrame(render);
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      const p = paramsRef.current;

      // Pause freezes time, not the RAF.
      if (!pausedRef.current) simTime += dt * p.velocidade;
      const t = simTime;

      resize();

      const blobs = blobsRef.current;
      const count = Math.min(blobs.length, MAX_BLOBS);

      updateBlobs(
        blobs,
        t,
        { wander: p.vagar, buoyancy: p.flutuacao, size: p.tamanho, variation: p.variacao },
        posArr,
        radArr,
      );

      const palette = [hexToVec3(p.corA), hexToVec3(p.corB), hexToVec3(p.corC)];
      for (let i = 0; i < count; i++) {
        const c = palette[blobs[i].colorIndex];
        colArr[i * 3] = c[0];
        colArr[i * 3 + 1] = c[1];
        colArr[i * 3 + 2] = c[2];
      }

      gl.uniform2f(uResolution, canvas.width, canvas.height);
      gl.uniform1f(uTime, t);
      gl.uniform1i(uCount, count);
      gl.uniform2fv(uPos, posArr);
      gl.uniform1fv(uRadius, radArr);
      gl.uniform3fv(uColor, colArr);
      const bg = hexToVec3(p.fundo);
      gl.uniform3f(uBg, bg[0], bg[1], bg[2]);
      gl.uniform1f(uThreshold, p.fusao);
      gl.uniform1f(uEdge, p.suavidade);
      gl.uniform1f(uGlow, p.glow);
      gl.uniform1f(uSaturation, p.saturacao);
      gl.uniform1f(uContrast, p.contraste);
      gl.uniform1f(uGrain, p.grao);
      gl.uniform1f(uGrainScale, p.escalaGrao);
      gl.uniform1f(uVignette, p.vinheta);

      gl.drawArrays(gl.TRIANGLES, 0, 6);
    };
    raf = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      gl.deleteBuffer(buf);
      gl.deleteVertexArray(vao);
      gl.deleteProgram(prog);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{ position: 'fixed', inset: 0, width: '100%', height: '100%', display: 'block' }}
    />
  );
}
