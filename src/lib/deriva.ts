/**
 * O keyframe `nnDrift` do protótipo, e o deslocamento de fase que substitui o
 * atraso negativo do CSS.
 *
 * ------------------------------------------------------------------
 * POR QUE ISTO NÃO MORA NO COMPONENTE
 *
 * Mora aqui por causa da regra 2: o `ManchasDaNinna.tsx` importa
 * `react-native-svg` e o Node não o carrega, então nada dentro dele é
 * verificável. Esta conta É verificável, e é a única parte do fundo animado que
 * pode estar errada sem ninguém ver:
 *
 * - entrada não estritamente crescente faz o `interpolate` JOGAR EXCEÇÃO — tela
 *   branca na aba Ninna, e ela nasce de dois pontos que caem no mesmo lugar por
 *   contas diferentes (`0 - fase` e `1 - fase`);
 * - fase errada não quebra nada: as três manchas só começam na pose errada, e
 *   ninguém compara 21 segundos de movimento com o protótipo a olho.
 *
 * O que sobra no componente é `Animated`, SVG e posição — coisa que só o
 * navegador julga.
 */

/** `@keyframes nnDrift` — tempo normalizado, deslocamento em px, escala. */
export const NN_DRIFT: { t: number; x: number; y: number; escala: number }[] = [
  { t: 0, x: 0, y: 0, escala: 1 },
  { t: 0.33, x: 14, y: -18, escala: 1.12 },
  { t: 0.66, x: -12, y: 10, escala: 0.94 },
  { t: 1, x: 0, y: 0, escala: 1 },
];

export type Pose = { x: number; y: number; escala: number };

/** Amostra o keyframe em `t`, interpolando linear entre os vizinhos. `t` dá volta. */
export function amostrar(t: number): Pose {
  const u = ((t % 1) + 1) % 1;
  for (let i = 0; i < NN_DRIFT.length - 1; i++) {
    const a = NN_DRIFT[i];
    const b = NN_DRIFT[i + 1];
    if (u < a.t || u > b.t) continue;
    const k = b.t === a.t ? 0 : (u - a.t) / (b.t - a.t);
    return {
      x: a.x + (b.x - a.x) * k,
      y: a.y + (b.y - a.y) * k,
      escala: a.escala + (b.escala - a.escala) * k,
    };
  }
  return { x: NN_DRIFT[0].x, y: NN_DRIFT[0].y, escala: NN_DRIFT[0].escala };
}

export type Curva = {
  entrada: number[];
  x: number[];
  y: number[];
  escala: number[];
};

/**
 * O protótipo desincroniza as manchas com **atraso negativo**
 * (`nnDrift 21s ease-in-out -6s infinite`): a animação já começa no meio.
 * `Animated` não tem isso — então em vez de atrasar o tempo, desloca-se o
 * keyframe.
 *
 * Queremos `g(u) = nnDrift((u + fase) mod 1)`. As quebras de `g` ficam onde `u`
 * leva `(u + fase)` a uma quebra original, e entre elas `g` continua sendo reta
 * — então a curva devolvida descreve `g` exatamente, não por aproximação.
 */
export function comFase(fase: number): Curva {
  const quebras = [0, 1, ...NN_DRIFT.map((k) => (((k.t - fase) % 1) + 1) % 1)]
    .sort((a, b) => a - b)
    // A tolerância não é preciosismo: `interpolate` exige entrada estritamente
    // crescente e joga exceção se dois pontos coincidirem.
    .filter((u, i, todas) => i === 0 || u - todas[i - 1] > 1e-6);

  const poses = quebras.map((u) => amostrar(u + fase));
  return {
    entrada: quebras,
    x: poses.map((p) => p.x),
    y: poses.map((p) => p.y),
    escala: poses.map((p) => p.escala),
  };
}
