# Lava Lamp Playground — Direção Artística e Técnica

Documento de referência para construir um simulador de "lava lamp" / metaballs em um playground web parametrizável. Leia inteiro antes de codar. O objetivo não é um lava lamp verde clássico — é a estética moderna de **blobs de gradiente que se fundem**, família mesh-gradient / Liquid Glass.

---

## 1. Objetivo

Um playground em browser onde se mexe em parâmetros ao vivo (via DialKit) e o output, por padrão, se parece com a referência (`reference_frame.png`): blobs orgânicos coloridos que flutuam devagar, se esticam e se fundem em formas de cápsula, com as cores se misturando nas sobreposições, sobre um fundo escuro profundo, com grão e leve vinheta.

---

## 2. Referência visual (decodificada do vídeo)

O vídeo original é 640×640, 30fps, ~10s de loop. Elementos:

- **Fundo:** azul-quase-preto, índigo profundo. Aproximadamente `#0A0C1A`. Quase morto, pra deixar a cor dos blobs gritar.
- **Blobs:** 2 a 3 grandes, circulares, de bordas muito suaves (gaussiana). Ocupam boa parte do quadro.
- **Cores vívidas e saturadas** por blob:
  - Azul azure — `~#1E7BFF`
  - Vermelho quente — `~#FF2A33`
  - Âmbar/laranja — `~#FFA31E`
- **A mágica está nas sobreposições:** onde dois blobs se cruzam, as cores se misturam de forma suave criando matizes novos — azul + vermelho viram um lavanda/malva dessaturado; vermelho + âmbar viram laranja vivo. Isso indica **mistura de cor ponderada pelo campo**, não blending aditivo puro (aditivo só estouraria pro branco).
- **Fusão metaball:** quando dois blobs chegam perto, em vez de só sobrepor, eles se esticam um na direção do outro e viram uma cápsula/amendoim única. É o efeito metaball clássico.
- **Bordas com glow:** a borda não é dura; há um halo suave de luz ao redor da massa.
- **Grão:** há uma textura de ruído fino por cima de tudo (film grain), sutil mas presente. É parte essencial do "feel" — sem grão fica plástico demais.
- **Vinheta:** leve escurecimento nos cantos, centralizando o olhar na massa.
- **Movimento:** lento, viscoso, orgânico. Os blobs vagam e se reencontram. Tem qualidade de "líquido pesado", não de bolha leve.

---

## 3. Princípios artísticos (o que faz parecer certo)

1. **Lentidão é tudo.** A viscosidade vende o realismo. Movimento rápido mata o efeito lava lamp. Default de velocidade baixo.
2. **A cor vive nas sobreposições.** O blob sozinho é bonito, mas o encontro é onde o visual acontece. A mistura ponderada precisa estar impecável.
3. **Fundo escuro, cor saturada.** Contraste alto entre o índigo morto e os blobs neon. Nunca clarear o fundo.
4. **Grão obrigatório.** Ele unifica a imagem e tira o aspecto "vetorial limpo demais". Sutil — perceptível, não dominante.
5. **Bordas suaves, nunca duras.** Tudo é gaussiano. O glow é o que dá o aspecto luminoso/etéreo.
6. **Fusão, não sobreposição.** Dois blobs perto têm que *virar um*. Se só empilham com transparência, perde a alma metaball.

---

## 4. Arquitetura técnica

- **Stack:** Vite + React + TypeScript.
- **Renderizador:** **WebGL2 com fragment shader** desenhado num quad fullscreen dentro de um `<canvas>`. **Não use Canvas2D** — o campo de metaball + mistura de cor por pixel + grão precisa do shader pra rodar a 60fps e ter o look certo.
- **Componente `<LavaLamp/>`:** encapsula o canvas, o contexto WebGL, o programa de shader, o loop de `requestAnimationFrame` e o set de uniforms.
- **Parâmetros → uniforms:** os valores do DialKit (via `useDialKit`) são lidos a cada frame e passados como uniforms. O shader não conhece o DialKit; só recebe números.
- **Resolução:** renderizar na devicePixelRatio (cap em 2) pra nitidez. A referência é quadrada, mas o canvas pode ser responsivo/fullscreen com a massa centralizada.
- **Loop:** tempo acumulado escalado por `velocidade`; ao pausar, congela o tempo (não o RAF).

---

## 5. O shader (essência)

Pseudo-GLSL do fragment. `MAX_BLOBS = 6`; arrays de posição/raio/cor vêm como uniforms; `uCount` diz quantos estão ativos.

```glsl
// uv normalizado, aspecto corrigido
float field = 0.0;
vec3  colSum = vec3(0.0);

for (int i = 0; i < MAX_BLOBS; i++) {
  if (i >= uCount) break;
  vec2  d = uv - uPos[i];
  float w = (uRadius[i] * uRadius[i]) / (dot(d, d) + 1e-4); // influência metaball
  field  += w;
  colSum += w * uColor[i];
}

vec3 blended = colSum / max(field, 1e-4);   // cor = média ponderada pelo campo

// massa: borda gooey por smoothstep no campo
float mask = smoothstep(uThreshold - uEdge, uThreshold + uEdge, field);

// halo/glow: falloff mais largo e suave fora da massa
float halo = smoothstep(uThreshold * 0.35, uThreshold, field);

vec3 col = mix(uBg, blended, mask);
col += blended * halo * uGlow * (1.0 - mask);  // adiciona luz só fora do núcleo

// saturação / contraste
col = saturate_adjust(col, uSaturation);
col = (col - 0.5) * uContrast + 0.5;

// grão (hash por pixel, levemente animado)
float g = (hash(uv * uGrainScale + uTime) - 0.5) * uGrain;
col += g;

// vinheta
float v = 1.0 - uVignette * dot(uv - 0.5, uv - 0.5) * 2.0;
col *= v;

gl_FragColor = vec4(col, 1.0);
```

**Movimento** (atualizado por frame na CPU ou no shader): cada blob tem posição base + deriva senoidal/perlin de baixa frequência + flutuação vertical (buoyancy do lava lamp).

```
t = uTime;                               // já escalado por velocidade
pos[i] = base[i]
       + vec2(sin(t*fx[i] + ph[i]), cos(t*fy[i] + ph2[i])) * uWander
       + vec2(0.0, sin(t*fb[i]) * uBuoyancy);
```

Para fusão de verdade, deixe as posições base se aproximarem e afastarem lentamente (ou use um leve campo de atração entre blobs) pra que cruzem e formem cápsulas.

**Notas:**
- Mais blobs que cores (`uCount > 3`)? Cicle as 3 cores da paleta (A, B, C) entre os blobs.
- A média ponderada (`colSum / field`) é o que dá o lavanda no encontro azul+vermelho. Não troque por aditivo.
- `hash`: função de ruído barata (ex.: `fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453)`).

---

## 6. Parâmetros (config do DialKit)

Tudo agrupado em folders. Defaults calibrados pra bater com a referência.

```ts
const p = useDialKit('Lava Lamp', {
  Movimento: {
    velocidade:  [0.30, 0, 1.5],     // viscosidade (baixo = lento/viscoso)
    vagar:       [0.18, 0, 0.5],     // amplitude da deriva horizontal/orbital
    flutuacao:   [0.12, 0, 0.5],     // buoyancy vertical (sobe/desce do lava lamp)
  },
  Forma: {
    blobs:       [3, 2, 6, 1],
    tamanho:     [0.26, 0.10, 0.50], // raio base
    variacao:    [0.40, 0, 1],       // variação de tamanho entre blobs
    fusao:       [1.00, 0.40, 2.0],  // threshold do campo (gooeyness)
    suavidade:   [0.35, 0.02, 1.0],  // largura do smoothstep (borda mole)
    glow:        [0.50, 0, 1.5],     // intensidade do halo
  },
  Cor: {
    fundo:       '#0A0C1A',
    corA:        '#1E7BFF',          // azure
    corB:        '#FF2A33',          // vermelho
    corC:        '#FFA31E',          // âmbar
    saturacao:   [1.10, 0, 2],
    contraste:   [1.00, 0.5, 1.6],
  },
  Textura: {
    grao:        [0.08, 0, 0.35],
    escalaGrao:  [1.00, 0.2, 4],
    vinheta:     [0.35, 0, 1],
  },
  randomizar:    { type: 'action' }, // novo seed/posições
  pausar:        { type: 'action' }, // congela/retoma o tempo
}, {
  onAction: (a) => {
    if (a === 'randomizar') reseed();
    if (a === 'pausar')     togglePause();
  },
});
```

Leitura no componente: `p.Movimento.velocidade`, `p.Cor.corA`, etc. Cores hex → converter pra `vec3` antes de mandar como uniform.

---

## 7. Setup do DialKit

```
npm install dialkit motion
```

No layout raiz, adicione `<DialRoot />` como **irmão** de `{children}` (não envolvendo) e importe os estilos:

```tsx
import { DialRoot } from 'dialkit'
import 'dialkit/styles.css'

export default function App() {
  return (
    <>
      <LavaLamp />
      <DialRoot position="top-right" theme="dark" />
    </>
  )
}
```

`useDialKit` é o hook; nested objects viram folders; hex viram color pickers; `[default, min, max, step?]` viram sliders; `{type:'action'}` viram botões (callback em `options.onAction`). Suporta export de JSON e presets nativos — útil pra salvar combinações que você gostar.

---

## 8. Critérios de pronto

- Roda a ~60fps numa tela cheia, sem travar ao mexer nos dials.
- O default bate de olho com `reference_frame.png`: fundo índigo, blobs azul/vermelho/âmbar, fusão em cápsula, mistura de cor no encontro, glow, grão, vinheta.
- **Todos** os dials afetam o visual ao vivo.
- Fusão metaball real (dois blobs viram um), não só sobreposição transparente.
- `randomizar` gera um novo arranjo; `pausar` congela e retoma.
- A mistura azul+vermelho produz lavanda (e não branco estourado nem preto).

---

## 9. Como dar a referência ao agente

O agente (Claude Code) provavelmente não "assiste" ao mp4. Extraia um frame e coloque no repo pra ele ter um still de comparação:

```
ffmpeg -ss 6 -i cosmos_1418616050.mp4 -frames:v 1 reference/frame.png
```

(`reference_frame.png` deste pacote já é um frame pronto, aos ~6s.)

---

## 10. Extensões futuras (não bloqueiam o MVP)

- Presets de paleta como `select` ("Cosmos", "Sunset", "Aurora", "Mono").
- Gradiente interno por blob (duas cores por blob, não uma) pra mais riqueza.
- Atração/repulsão real entre blobs (campo de forças) em vez de deriva senoidal.
- Export do loop como vídeo/GIF.
- Modo "responsivo ao som" ou ao cursor.
