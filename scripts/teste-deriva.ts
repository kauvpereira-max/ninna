// A conta do fundo animado da aba Ninna — `src/lib/deriva.ts`.
//
//   node scripts/teste-deriva.ts
//
// POR QUE ESTE ARQUIVO EXISTE
//
// As três manchas são a coisa MENOS testável do app: elas só existem no
// navegador, ao longo de 21 segundos. `tsc` prova que compila, o `expo export`
// empacota uma animação quebrada com o mesmo sucesso que uma correta, e nenhum
// teste de Node abre tela. É a regra 2b em estado puro.
//
// O que dá para provar é a única parte que pode estar errada em silêncio: o
// deslocamento de fase que substitui o atraso negativo do CSS. E ela erra de
// dois jeitos bem diferentes:
//
//   - entrada não crescente faz o `interpolate` do `Animated` JOGAR EXCEÇÃO —
//     tela branca na aba Ninna. Nasce de dois pontos que caem no mesmo lugar por
//     contas diferentes (`0 - fase` e `1 - fase`), e a fase 6/21 do protótipo é
//     exatamente um desses casos;
//   - fase errada não quebra NADA. As manchas só começam na pose errada, e
//     ninguém compara 21 segundos de movimento com o protótipo a olho.
//
// A prova de que este teste morde está no fim: três mutações que ele TEM que
// reprovar. Sem elas, "3 fases corretas" e "a conta inteira zerada" dariam o
// mesmo verde.

import { NN_DRIFT, amostrar, comFase, type Curva } from '../src/lib/deriva.ts';

let falhas = 0;

function conferir(nome: string, ok: boolean, detalhe?: string) {
  if (ok) return;
  falhas++;
  console.log(`[ FALHA] ${nome}${detalhe ? `\n         ${detalhe}` : ''}`);
}

const perto = (a: number, b: number, tol = 1e-9) => Math.abs(a - b) < tol;

// ------------------------------------------------------------------
// 1. O keyframe é o do protótipo, literal
// ------------------------------------------------------------------

conferir(
  'nnDrift tem as quatro paradas do CSS',
  JSON.stringify(NN_DRIFT) ===
    JSON.stringify([
      { t: 0, x: 0, y: 0, escala: 1 },
      { t: 0.33, x: 14, y: -18, escala: 1.12 },
      { t: 0.66, x: -12, y: 10, escala: 0.94 },
      { t: 1, x: 0, y: 0, escala: 1 },
    ]),
  'o `@keyframes nnDrift` do protótipo mudou, ou alguém arredondou um valor',
);

// O ciclo FECHA: se o fim não voltar ao começo, a animação dá um salto visível
// a cada volta — 3 vezes por minuto, para sempre.
conferir('o ciclo fecha em 0/0/1', perto(amostrar(1).x, 0) && perto(amostrar(1).y, 0) && perto(amostrar(1).escala, 1));
conferir('t dá volta: amostrar(1.25) == amostrar(0.25)', perto(amostrar(1.25).x, amostrar(0.25).x));
conferir('t negativo dá volta: amostrar(-0.25) == amostrar(0.75)', perto(amostrar(-0.25).x, amostrar(0.75).x));

// O meio de uma perna é a média dos extremos — é o que "linear" quer dizer, e é
// o que quebraria se alguém trocasse a busca de vizinhos por um índice fixo.
conferir('metade da 1ª perna dá metade do deslocamento', perto(amostrar(0.165).x, 7));
conferir('metade da 1ª perna dá metade da escala', perto(amostrar(0.165).escala, 1.06));

// ------------------------------------------------------------------
// 2. A curva com fase — o que o `interpolate` exige
// ------------------------------------------------------------------

/** As três do protótipo, mais as bordas e um punhado de casos aleatórios fixos. */
const FASES = [0, 6 / 21, 11 / 19, 0.33, 0.66, 0.999, 0.5, 0.001, 0.25, 0.75];

function provarCurva(fase: number, curva: Curva): string | null {
  if (curva.entrada[0] !== 0) return `não começa em 0 (${curva.entrada[0]})`;
  if (curva.entrada[curva.entrada.length - 1] !== 1) return 'não termina em 1';
  for (let i = 1; i < curva.entrada.length; i++) {
    if (curva.entrada[i] <= curva.entrada[i - 1]) {
      return `entrada não é crescente em ${i}: ${curva.entrada[i - 1]} → ${curva.entrada[i]}`;
    }
  }
  if (
    curva.x.length !== curva.entrada.length ||
    curva.y.length !== curva.entrada.length ||
    curva.escala.length !== curva.entrada.length
  ) {
    return 'saída de tamanho diferente da entrada — `interpolate` recusa';
  }
  // A volta tem que fechar TAMBÉM com fase: senão o salto por ciclo aparece só
  // em duas das três manchas, que é o tipo de defeito que ninguém localiza.
  if (!perto(curva.x[0], curva.x[curva.x.length - 1], 1e-6)) return 'o ciclo com fase não fecha em x';
  if (!perto(curva.escala[0], curva.escala[curva.escala.length - 1], 1e-6)) {
    return 'o ciclo com fase não fecha na escala';
  }
  return null;
}

for (const fase of FASES) {
  const erro = provarCurva(fase, comFase(fase));
  conferir(`curva utilizável na fase ${fase.toFixed(4)}`, erro === null, erro ?? undefined);
}

// ------------------------------------------------------------------
// 3. A fase faz o que ela promete
// ------------------------------------------------------------------
//
// A promessa é uma só: `curva(u) == nnDrift((u + fase) mod 1)`. Se ela valer em
// pontos escolhidos ENTRE as quebras, a curva é a função deslocada — e não só um
// conjunto de pontos que por acaso coincide nas quebras.

/** Interpola a curva devolvida, do jeito que o `Animated` interpolaria. */
function ler(curva: Curva, canal: 'x' | 'y' | 'escala', u: number): number {
  const e = curva.entrada;
  for (let i = 0; i < e.length - 1; i++) {
    if (u < e[i] || u > e[i + 1]) continue;
    const k = (u - e[i]) / (e[i + 1] - e[i]);
    return curva[canal][i] + (curva[canal][i + 1] - curva[canal][i]) * k;
  }
  return curva[canal][0];
}

for (const fase of FASES) {
  const curva = comFase(fase);
  let pior = 0;
  for (let n = 0; n <= 200; n++) {
    const u = n / 200;
    const esperado = amostrar(u + fase);
    pior = Math.max(
      pior,
      Math.abs(ler(curva, 'x', u) - esperado.x),
      Math.abs(ler(curva, 'y', u) - esperado.y),
      Math.abs(ler(curva, 'escala', u) - esperado.escala) * 100,
    );
  }
  conferir(
    `a curva da fase ${fase.toFixed(4)} É o keyframe deslocado`,
    pior < 1e-6,
    `maior desvio: ${pior}`,
  );
}

// A fase 0 tem que devolver o keyframe original, sem ponto sobrando.
//
// ⚠️ A comparação é POR TOLERÂNCIA, e não por igualdade, porque a volta pelo
// módulo não é neutra em ponto flutuante: `((0.33 - 0) % 1 + 1) % 1` devolve
// 0.33000000000000007. Isso não atrapalha o `interpolate` — a entrada segue
// crescente e o desvio é de 1e-16 —, mas uma asserção exata aqui reprovaria a
// conta certa, e teste que reprova o certo é desligado.
{
  const entrada = comFase(0).entrada;
  const original = [0, 0.33, 0.66, 1];
  conferir(
    'fase 0 devolve o keyframe original, sem ponto sobrando',
    entrada.length === original.length && entrada.every((u, i) => perto(u, original[i], 1e-9)),
    `veio ${JSON.stringify(entrada)}`,
  );
}

// E a fase tem que MUDAR alguma coisa: fases diferentes, poses iniciais
// diferentes. Sem isto, `comFase` devolvendo sempre o keyframe original passaria
// em tudo acima que não fosse a comparação ponto a ponto.
conferir(
  'fases diferentes começam em poses diferentes',
  new Set(FASES.map((f) => `${amostrar(f).x.toFixed(4)}|${amostrar(f).escala.toFixed(4)}`)).size >= 8,
);

// ------------------------------------------------------------------
// 4. As mutações — o teste tem que morder
// ------------------------------------------------------------------
//
// Cada uma é um jeito plausível de escrever a conta errado. Se qualquer uma
// PASSAR, a bateria acima está frouxa e o verde não significa nada.

type Mutacao = { nome: string; comFase: (fase: number) => Curva };

const MUTACOES: Mutacao[] = [
  {
    // O erro mais provável: esquecer as bordas e sair só das quebras do
    // keyframe. A curva não começa em 0 nem termina em 1, e o `Animated`
    // extrapola o resto — o movimento vaza fora do desenho.
    nome: 'sem as bordas 0 e 1',
    comFase: (fase) => {
      const quebras = NN_DRIFT.map((k) => (((k.t - fase) % 1) + 1) % 1).sort((a, b) => a - b);
      const poses = quebras.map((u) => amostrar(u + fase));
      return {
        entrada: quebras,
        x: poses.map((p) => p.x),
        y: poses.map((p) => p.y),
        escala: poses.map((p) => p.escala),
      };
    },
  },
  {
    // O que a tolerância de 1e-6 existe para pegar: sem ela, `0 - fase` e
    // `1 - fase` viram dois pontos iguais e o `interpolate` joga exceção.
    nome: 'sem a limpeza de pontos coincidentes',
    comFase: (fase) => {
      const quebras = [0, 1, ...NN_DRIFT.map((k) => (((k.t - fase) % 1) + 1) % 1)].sort((a, b) => a - b);
      const poses = quebras.map((u) => amostrar(u + fase));
      return {
        entrada: quebras,
        x: poses.map((p) => p.x),
        y: poses.map((p) => p.y),
        escala: poses.map((p) => p.escala),
      };
    },
  },
  {
    // A fase entra na conta das quebras mas não na das poses. Passa em tudo que
    // olhe só o formato da curva, e desenha o movimento errado.
    nome: 'fase aplicada às quebras, não às poses',
    comFase: (fase) => {
      const c = comFase(fase);
      const poses = c.entrada.map((u) => amostrar(u));
      return {
        entrada: c.entrada,
        x: poses.map((p) => p.x),
        y: poses.map((p) => p.y),
        escala: poses.map((p) => p.escala),
      };
    },
  },
];

for (const mutacao of MUTACOES) {
  let reprovou = false;
  for (const fase of FASES) {
    let curva: Curva;
    try {
      curva = mutacao.comFase(fase);
    } catch {
      reprovou = true;
      break;
    }
    if (provarCurva(fase, curva) !== null) {
      reprovou = true;
      break;
    }
    for (let n = 0; n <= 200; n++) {
      const u = n / 200;
      const esperado = amostrar(u + fase);
      if (Math.abs(ler(curva, 'x', u) - esperado.x) > 1e-6) {
        reprovou = true;
        break;
      }
    }
    if (reprovou) break;
  }
  conferir(
    `a mutação "${mutacao.nome}" é reprovada`,
    reprovou,
    'a bateria passou numa conta errada — ela não está provando o que diz',
  );
}

console.log(
  falhas === 0
    ? '\nDeriva das manchas: keyframe literal, fase exata, e as 3 mutações reprovadas.'
    : `\n${falhas} falha(s) na deriva das manchas.`,
);

process.exit(falhas === 0 ? 0 : 1);
