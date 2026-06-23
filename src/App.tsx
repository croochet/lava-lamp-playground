import { useCallback, useState } from 'react';
import { DialRoot, useDialKit } from 'dialkit';
import 'dialkit/styles.css';
import LavaLamp, { type LavaParams } from './lava/LavaLamp';

export default function App() {
  const [seed, setSeed] = useState(7);
  const [paused, setPaused] = useState(false);

  const onAction = useCallback((a: string) => {
    if (a === 'randomizar') setSeed((s) => (s + 1) | 0);
    if (a === 'pausar') setPaused((v) => !v);
  }, []);

  const p = useDialKit(
    'Lava Lamp',
    {
      Movimento: {
        velocidade: [0.3, 0, 1.5],
        vagar: [0.18, 0, 0.5],
        flutuacao: [0.12, 0, 0.5],
      },
      Forma: {
        blobs: [3, 2, 6, 1],
        tamanho: [0.26, 0.1, 0.5],
        variacao: [0.4, 0, 1],
        fusao: [1.0, 0.4, 2.0],
        suavidade: [0.35, 0.02, 1.0],
        glow: [0.5, 0, 1.5],
      },
      Cor: {
        fundo: '#0A0C1A',
        corA: '#1E7BFF',
        corB: '#FF2A33',
        corC: '#FFA31E',
        saturacao: [1.1, 0, 2],
        contraste: [1.0, 0.5, 1.6],
      },
      Textura: {
        grao: [0.08, 0, 0.35],
        escalaGrao: [1.0, 0.2, 4],
        vinheta: [0.35, 0, 1],
      },
      randomizar: { type: 'action' },
      pausar: { type: 'action' },
    },
    { onAction },
  );

  // Flatten DialKit folders into the flat uniform-feeding shape.
  const params: LavaParams = {
    velocidade: p.Movimento.velocidade,
    vagar: p.Movimento.vagar,
    flutuacao: p.Movimento.flutuacao,
    blobs: p.Forma.blobs,
    tamanho: p.Forma.tamanho,
    variacao: p.Forma.variacao,
    fusao: p.Forma.fusao,
    suavidade: p.Forma.suavidade,
    glow: p.Forma.glow,
    fundo: p.Cor.fundo,
    corA: p.Cor.corA,
    corB: p.Cor.corB,
    corC: p.Cor.corC,
    saturacao: p.Cor.saturacao,
    contraste: p.Cor.contraste,
    grao: p.Textura.grao,
    escalaGrao: p.Textura.escalaGrao,
    vinheta: p.Textura.vinheta,
  };

  return (
    <>
      <LavaLamp params={params} seed={seed} paused={paused} />
      <DialRoot position="top-right" theme="dark" productionEnabled />
    </>
  );
}
